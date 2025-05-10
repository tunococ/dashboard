module;

#include <chrono>
#include <iostream>

#include <SDL3/SDL.h>
#include <SDL3/SDL_init.h>
#include <SDL3/SDL_render.h>

export module dashboard.app;

import dashboard.utils;
import dashboard.sdl_glue;

export struct App {
  SDL_AppResult init(int argc, char **argv);
  SDL_AppResult onTick();
  SDL_AppResult onEvent(SDL_Event *event);
  void onExit(SDL_AppResult result);

  SDL_Window *window{nullptr};
  SDL_Renderer *renderer{nullptr};

  using Clock = std::chrono::steady_clock;
  std::chrono::time_point<Clock> last_tick_time;
  std::chrono::time_point<Clock> last_event_time;
};

static_assert(SdlApp<App>);

SDL_AppResult App::init(int argc, char **argv) {
  SDL_Init(SDL_INIT_VIDEO);
  if (!SDL_CreateWindowAndRenderer("dashboard", 640, 480, SDL_WINDOW_RESIZABLE,
                                   &window, &renderer)) {
    std::cout << "SDL_CreateWindowAndRenderer failed -- " << SDL_GetError()
              << std::endl;
    return SDL_APP_FAILURE;
  }

  return SDL_APP_CONTINUE;
}

SDL_AppResult App::onTick() {
  using namespace std::chrono_literals;
  std::chrono::time_point<Clock> now = Clock::now();
  Defer save_last_tick_time{[this, now]() { last_tick_time = now; }};

  std::cout << "tick" << std::endl;
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
    SDL_KeyboardEvent *kb_event = reinterpret_cast<SDL_KeyboardEvent *>(event);
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
  if (window) {
    SDL_DestroyWindow(window);
    window = nullptr;
  }
  SDL_Quit();
}
