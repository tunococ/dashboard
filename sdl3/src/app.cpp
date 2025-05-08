#include <chrono>
#include <iostream>
#include <thread>

#include <SDL3/SDL.h>
#include <SDL3/SDL_init.h>

#include "app.hpp"

SDL_AppResult App::init(int argc, char **argv) {
  SDL_Init(SDL_INIT_VIDEO);
  window = SDL_CreateWindow("Dashboard", 640, 480, SDL_WINDOW_OPENGL);
  if (!window) {
    std::cout << "window is null" << std::endl;
    return SDL_APP_FAILURE;
  }
  std::cout << "window created" << std::endl;

  return SDL_APP_CONTINUE;
}

SDL_AppResult App::onTick() {
  using namespace std::chrono_literals;
  std::this_thread::sleep_for(200ms);

  const auto epochTime = std::chrono::system_clock::now().time_since_epoch();
  std::cout << "ticking: " << epochTime.count() << std::endl;
  return SDL_APP_CONTINUE;
}

SDL_AppResult App::onEvent(SDL_Event *event) {
  if (event && event->type == SDL_EVENT_QUIT) {
    return SDL_APP_SUCCESS;
  }
  return SDL_APP_CONTINUE;
}

void App::onExit(SDL_AppResult result) {
  if (window) {
    SDL_DestroyWindow(window);
    std::cout << "window destroyed" << std::endl;
    window = nullptr;
  }
  std::cout << "quitting" << std::endl;
  SDL_Quit();
}
