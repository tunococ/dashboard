module;

#include <algorithm>
#include <array>
#include <chrono>
#include <iostream>

#include <SDL3/SDL.h>
#include <SDL3/SDL_gpu.h>
#include <SDL3/SDL_init.h>
#include <SDL3/SDL_iostream.h>
#include <SDL3/SDL_render.h>
#include <SDL3/SDL_video.h>

export module dashboard.app;

import dashboard.utils;
import dashboard.sdl_glue;

export struct App {
  SDL_AppResult init(int argc, char **argv);
  SDL_AppResult onTick();
  SDL_AppResult onEvent(SDL_Event *event);
  void onExit(SDL_AppResult result);
  ~App();

  using Clock = std::chrono::steady_clock;
  std::chrono::time_point<Clock> last_tick_time;
  std::chrono::time_point<Clock> last_event_time;

  SDL_Window *window{nullptr};
  SDL_Renderer *renderer{nullptr};
  SDL_GPUDevice *gpu_device{nullptr};
  SDL_GPUBuffer *vertex_buffer{nullptr};
  SDL_GPUTransferBuffer *transfer_buffer{nullptr};

  struct Vertex {
    float x, y, z;
    float r, g, b, a;
  };

  static constexpr Vertex TRIANGLE_VERTICES[] = {
      {0.0f, 0.5f, 0.0f, 1.0f, 0.0f, 0.0f, 1.0f},    // top vertex
      {-0.5f, -0.5f, 0.0f, 1.0f, 1.0f, 0.0f, 1.0f},  // bottom left vertex
      {0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 1.0f, 1.0f}};

  SDL_GPUGraphicsPipeline *graphics_pipeline{nullptr};
};

static_assert(SdlApp<App>);

SDL_AppResult App::init(int argc, char **argv) {
  SDL_Init(SDL_INIT_VIDEO);

  // if (!SDL_CreateWindowAndRenderer("dashboard", 1200, 800,
  // SDL_WINDOW_RESIZABLE,
  //                                  &window, &renderer)) {
  //   std::cout << "SDL_CreateWindowAndRenderer failed -- " << SDL_GetError()
  //             << std::endl;
  //   return SDL_APP_FAILURE;
  // }
  window = SDL_CreateWindow("Dashboard", 960, 540, SDL_WINDOW_RESIZABLE);
  if (!window) {
    std::cout << "SDL_CreateWindow failed -- " << SDL_GetError() << std::endl;
    return SDL_APP_FAILURE;
  }
  SDL_SetWindowPosition(window, SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED);
  SDL_ShowWindow(window);

  gpu_device = SDL_CreateGPUDevice(SDL_GPU_SHADERFORMAT_SPIRV, false, nullptr);
  if (!gpu_device) {
    std::cout << "SDL_CreateGPUDevice failed -- " << SDL_GetError()
              << std::endl;
    return SDL_APP_FAILURE;
  }

  if (!SDL_ClaimWindowForGPUDevice(gpu_device, window)) {
    std::cout << "SDL_ClaimWindowForGPUDevice failed -- " << SDL_GetError()
              << std::endl;
    return SDL_APP_FAILURE;
  }

  {  // Create the graphics pipeline

    // Load the vertex shader
    std::size_t vertex_shader_code_size;
    void *vertex_shader_code{nullptr};
    vertex_shader_code =
        SDL_LoadFile("shaders/vertex.spv", &vertex_shader_code_size);
    if (!vertex_shader_code) {
      std::cout << "SDL_LoadFile failed to load shaders/vertex.spv -- "
                << SDL_GetError() << std::endl;
      return SDL_APP_FAILURE;
    }
    SDL_GPUShaderCreateInfo vertex_shader_info{};
    vertex_shader_info.code = reinterpret_cast<Uint8 *>(vertex_shader_code);
    vertex_shader_info.code_size = vertex_shader_code_size;
    vertex_shader_info.entrypoint = "main";
    vertex_shader_info.format = SDL_GPU_SHADERFORMAT_SPIRV;
    vertex_shader_info.stage = SDL_GPU_SHADERSTAGE_VERTEX;
    vertex_shader_info.num_samplers = 0;
    vertex_shader_info.num_storage_buffers = 0;
    vertex_shader_info.num_storage_textures = 0;
    vertex_shader_info.num_uniform_buffers = 0;
    SDL_GPUShader *vertex_shader =
        SDL_CreateGPUShader(gpu_device, &vertex_shader_info);
    if (!vertex_shader) {
      std::cout << "SDL_CreateGPUShader failed to create a vertex shader -- "
                << SDL_GetError() << std::endl;
      return SDL_APP_FAILURE;
    }
    Defer release_vertex_shader([&vertex_shader, this]() {
      if (vertex_shader) {
        SDL_ReleaseGPUShader(gpu_device, vertex_shader);
      }
    });

    // Load the fragment shader
    std::size_t fragment_shader_code_size;
    void *fragment_shader_code{nullptr};
    fragment_shader_code =
        SDL_LoadFile("shaders/fragment.spv", &fragment_shader_code_size);
    if (!fragment_shader_code) {
      std::cout << "SDL_LoadFile failed to load shaders/fragment.spv -- "
                << SDL_GetError() << std::endl;
      return SDL_APP_FAILURE;
    }
    SDL_GPUShaderCreateInfo fragment_shader_info{};
    fragment_shader_info.code = (Uint8 *)fragment_shader_code;
    fragment_shader_info.code_size = fragment_shader_code_size;
    fragment_shader_info.entrypoint = "main";
    fragment_shader_info.format = SDL_GPU_SHADERFORMAT_SPIRV;
    fragment_shader_info.stage = SDL_GPU_SHADERSTAGE_FRAGMENT;
    fragment_shader_info.num_samplers = 0;
    fragment_shader_info.num_storage_buffers = 0;
    fragment_shader_info.num_storage_textures = 0;
    fragment_shader_info.num_uniform_buffers = 0;
    SDL_GPUShader *fragment_shader =
        SDL_CreateGPUShader(gpu_device, &fragment_shader_info);
    if (!fragment_shader) {
      std::cout << "SDL_CreateGPUShader failed to create a fragment shader -- "
                << SDL_GetError() << std::endl;
      return SDL_APP_FAILURE;
    }
    Defer release_fragment_shader([&fragment_shader, this]() {
      if (fragment_shader) {
        SDL_ReleaseGPUShader(gpu_device, fragment_shader);
      }
    });

    SDL_GPUGraphicsPipelineCreateInfo pipeline_create_info{};
    pipeline_create_info.vertex_shader = vertex_shader;
    pipeline_create_info.fragment_shader = fragment_shader;
    pipeline_create_info.primitive_type = SDL_GPU_PRIMITIVETYPE_TRIANGLELIST;

    SDL_GPUVertexBufferDescription vertex_buffer_descriptions[1] = {{}};
    vertex_buffer_descriptions[0].slot = 0;
    vertex_buffer_descriptions[0].input_rate = SDL_GPU_VERTEXINPUTRATE_VERTEX;
    vertex_buffer_descriptions[0].instance_step_rate = 0;
    vertex_buffer_descriptions[0].pitch = sizeof(Vertex);

    pipeline_create_info.vertex_input_state.num_vertex_buffers =
        std::size(vertex_buffer_descriptions);
    pipeline_create_info.vertex_input_state.vertex_buffer_descriptions =
        vertex_buffer_descriptions;

    SDL_GPUVertexAttribute vertex_attributes[2];

    // a_position
    vertex_attributes[0].buffer_slot =
        0;                              // fetch data from the buffer at slot 0
    vertex_attributes[0].location = 0;  // layout (location = 0) in shader
    vertex_attributes[0].format = SDL_GPU_VERTEXELEMENTFORMAT_FLOAT3;  // vec3
    vertex_attributes[0].offset = offsetof(Vertex, x);

    // a_color
    vertex_attributes[1].buffer_slot = 0;  // use buffer at slot 0
    vertex_attributes[1].location = 1;     // layout (location = 1) in shader
    vertex_attributes[1].format = SDL_GPU_VERTEXELEMENTFORMAT_FLOAT4;  // vec4
    vertex_attributes[1].offset = offsetof(Vertex, r);

    pipeline_create_info.vertex_input_state.num_vertex_attributes =
        std::size(vertex_attributes);
    pipeline_create_info.vertex_input_state.vertex_attributes =
        vertex_attributes;

    // describe the color target
    SDL_GPUColorTargetDescription color_target_descriptions[1] = {{}};
    color_target_descriptions[0].blend_state.enable_blend = true;
    color_target_descriptions[0].blend_state.color_blend_op =
        SDL_GPU_BLENDOP_ADD;
    color_target_descriptions[0].blend_state.alpha_blend_op =
        SDL_GPU_BLENDOP_ADD;
    color_target_descriptions[0].blend_state.src_color_blendfactor =
        SDL_GPU_BLENDFACTOR_SRC_ALPHA;
    color_target_descriptions[0].blend_state.dst_color_blendfactor =
        SDL_GPU_BLENDFACTOR_ONE_MINUS_SRC_ALPHA;
    color_target_descriptions[0].blend_state.src_alpha_blendfactor =
        SDL_GPU_BLENDFACTOR_SRC_ALPHA;
    color_target_descriptions[0].blend_state.dst_alpha_blendfactor =
        SDL_GPU_BLENDFACTOR_ONE_MINUS_SRC_ALPHA;
    color_target_descriptions[0].format =
        SDL_GetGPUSwapchainTextureFormat(gpu_device, window);

    pipeline_create_info.target_info.num_color_targets =
        std::size(color_target_descriptions);
    pipeline_create_info.target_info.color_target_descriptions =
        color_target_descriptions;

    graphics_pipeline =
        SDL_CreateGPUGraphicsPipeline(gpu_device, &pipeline_create_info);
    if (!graphics_pipeline) {
      std::cout << "SDL_CreateGPUGraphicsPipeline failed -- " << SDL_GetError()
                << std::endl;
      return SDL_APP_FAILURE;
    }
  }

  SDL_GPUBufferCreateInfo buffer_info{};
  buffer_info.size = sizeof(TRIANGLE_VERTICES);
  buffer_info.usage = SDL_GPU_BUFFERUSAGE_VERTEX;
  vertex_buffer = SDL_CreateGPUBuffer(gpu_device, &buffer_info);

  SDL_GPUTransferBufferCreateInfo transfer_buffer_create_info{};
  transfer_buffer_create_info.size = sizeof(TRIANGLE_VERTICES);
  transfer_buffer =
      SDL_CreateGPUTransferBuffer(gpu_device, &transfer_buffer_create_info);

  if (!transfer_buffer) {
    std::cout << "SDL_CreateGPUTransferBuffer failed -- " << SDL_GetError()
              << std::endl;
    return SDL_APP_FAILURE;
  }

  void *mapped_transfer_buffer =
      SDL_MapGPUTransferBuffer(gpu_device, transfer_buffer, true);

  if (!mapped_transfer_buffer) {
    std::cout << "SDL_MapGPUTransferBuffer failed -- " << SDL_GetError()
              << std::endl;
    return SDL_APP_FAILURE;
  }

  std::copy(TRIANGLE_VERTICES, TRIANGLE_VERTICES + std::size(TRIANGLE_VERTICES),
            reinterpret_cast<Vertex *>(mapped_transfer_buffer));

  SDL_UnmapGPUTransferBuffer(gpu_device, transfer_buffer);

  return SDL_APP_CONTINUE;
}

SDL_AppResult App::onTick() {
  using namespace std::chrono_literals;
  std::chrono::time_point<Clock> now = Clock::now();
  Defer save_last_tick_time{[this, now]() { last_tick_time = now; }};

  std::cout << "tick" << std::endl;

  SDL_GPUCommandBuffer *command_buffer =
      SDL_AcquireGPUCommandBuffer(gpu_device);

  if (!command_buffer) {
    std::cout << "SDL_AcquireGPUCommandBuffer failed -- " << SDL_GetError()
              << std::endl;
    return SDL_APP_FAILURE;
  }

  Defer submit_command_buffer([&command_buffer]() {
    if (command_buffer) {
      SDL_SubmitGPUCommandBuffer(command_buffer);
      command_buffer = nullptr;
    }
  });

  {
    // Copy data from transfer_buffer to vertex_buffer
    SDL_GPUCopyPass *copy_pass = SDL_BeginGPUCopyPass(command_buffer);

    SDL_GPUTransferBufferLocation source{};
    source.transfer_buffer = transfer_buffer;
    source.offset = 0;

    SDL_GPUBufferRegion destination{};
    destination.buffer = vertex_buffer;
    destination.size = sizeof(TRIANGLE_VERTICES);
    destination.offset = 0;

    SDL_UploadToGPUBuffer(copy_pass, &source, &destination, true);

    SDL_EndGPUCopyPass(copy_pass);
  }

  SDL_GPUTexture *swapchain_texture{};
  Uint32 width, height;
  SDL_WaitAndAcquireGPUSwapchainTexture(command_buffer, window,
                                        &swapchain_texture, &width, &height);

  if (!swapchain_texture) {
    std::cout << "SDL_WaitAndAcquireGPUSwapchainTexture failed -- "
              << SDL_GetError() << std::endl;
    return SDL_APP_CONTINUE;
  }

  SDL_GPUColorTargetInfo color_target_info{};
  color_target_info.clear_color = {0.3f, 0.4f, 0.6f, 1.0f};
  color_target_info.load_op = SDL_GPU_LOADOP_CLEAR;

  color_target_info.store_op = SDL_GPU_STOREOP_STORE;
  color_target_info.texture = swapchain_texture;

  SDL_GPURenderPass *render_pass =
      SDL_BeginGPURenderPass(command_buffer, &color_target_info, 1, NULL);

  SDL_BindGPUGraphicsPipeline(render_pass, graphics_pipeline);

  SDL_GPUBufferBinding buffer_bindings[1];
  buffer_bindings[0].buffer = vertex_buffer;
  buffer_bindings[0].offset = 0;

  SDL_BindGPUVertexBuffers(render_pass, 0, buffer_bindings,
                           std::size(buffer_bindings));

  SDL_DrawGPUPrimitives(render_pass, 3, 1, 0, 0);

  SDL_EndGPURenderPass(render_pass);

  SDL_SubmitGPUCommandBuffer(command_buffer);
  command_buffer = nullptr;

  return SDL_APP_CONTINUE;
}

SDL_AppResult App::onEvent(SDL_Event *event) {
  if (!event) {
    return SDL_APP_FAILURE;
  }
  std::chrono::time_point<Clock> now = Clock::now();
  Defer save_last_event_time{[this, now]() { last_event_time = now; }};

  switch (event->type) {
    case SDL_EVENT_QUIT: {
      return SDL_APP_SUCCESS;
    }
    case SDL_EVENT_KEY_DOWN: {
      SDL_KeyboardEvent *kb_event =
          reinterpret_cast<SDL_KeyboardEvent *>(event);
      if (kb_event->key == SDLK_Q) {
        return SDL_APP_SUCCESS;
      }
    }
    default: {
      std::cout << "event: " << event->type << std::endl;
    }
  }

  return SDL_APP_CONTINUE;
}

void App::onExit(SDL_AppResult result) {
  if (renderer) {
    SDL_DestroyRenderer(renderer);
    renderer = nullptr;
  }
  if (gpu_device) {
    if (graphics_pipeline) {
      SDL_ReleaseGPUGraphicsPipeline(gpu_device, graphics_pipeline);
      graphics_pipeline = nullptr;
    }
    if (transfer_buffer) {
      SDL_ReleaseGPUTransferBuffer(gpu_device, transfer_buffer);
      transfer_buffer = nullptr;
    }
    if (vertex_buffer) {
      SDL_ReleaseGPUBuffer(gpu_device, vertex_buffer);
      vertex_buffer = nullptr;
    }
    SDL_DestroyGPUDevice(gpu_device);
    gpu_device = nullptr;
  }
  if (window) {
    SDL_DestroyWindow(window);
    window = nullptr;
  }
  SDL_Quit();
}

App::~App() {}
