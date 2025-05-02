#include <concepts>
#include <SDL3/SDL_init.h>

template <typename T>
concept SdlApp = requires(T app, int argc, char** argv, SDL_AppResult result, SDL_Event* event) {
  { app.init(argc, argv) } -> std::convertible_to<SDL_AppResult>;
  { app.onTick() } -> std::convertible_to<SDL_AppResult>;
  { app.onEvent(event) } -> std::convertible_to<SDL_AppResult>;
  app.onExit(result);
};

