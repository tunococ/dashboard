#pragma once

#include "SDL3/SDL_render.h"
#include <chrono>

#include <SDL3/SDL.h>
#include <SDL3/SDL_init.h>

#include <sdl_glue/SdlApp.hpp>

struct App {
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
