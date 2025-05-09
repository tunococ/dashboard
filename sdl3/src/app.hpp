#pragma once

#include <SDL3/SDL.h>
#include <SDL3/SDL_init.h>

#include <sdl_glue/SdlApp.hpp>

struct App {
  SDL_AppResult init(int argc, char **argv);
  SDL_AppResult onTick();
  SDL_AppResult onEvent(SDL_Event *event);
  void onExit(SDL_AppResult result);

  SDL_Window *window;
};

static_assert(SdlApp<App>);
