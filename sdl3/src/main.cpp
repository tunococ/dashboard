#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

#include "interfaces/SdlApp.hpp"
#include "app.hpp"

static_assert(SdlApp<App>);

int main(int argc, char* argv[]) {
  App app{};

  SDL_AppResult result = app.init(argc, argv);
  if (result == SDL_APP_SUCCESS) {
    return 0;
  }
  if (result == SDL_APP_FAILURE) {
    return 1;
  }

  while (result == SDL_APP_CONTINUE) {
    SDL_Event event;
    while (SDL_PollEvent(&event)) {
      result = app.onEvent(&event);
      if (result != SDL_APP_CONTINUE) {
        break;
      }
    }
    if (result != SDL_APP_CONTINUE) {
      break;
    }
    result = app.onTick();
    // Do game logic, present a frame, etc.
  }

  app.onExit(result);
  return result == SDL_APP_SUCCESS ? 0 : 1;
}


