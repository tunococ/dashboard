#include <SDL3/SDL.h>
#include <SDL3/SDL_assert.h>
#include <SDL3/SDL_main.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

#include <sdl_glue/SdlApp.hpp>
#include <utils/defer.hpp>

#include "app.hpp"

static_assert(SdlApp<App>);

using namespace std::chrono_literals;
using Clock = std::chrono::steady_clock;

// constexpr Clock::duration TICK_PERIOD = 16'666'666ns;
constexpr Clock::duration TICK_PERIOD = 1s;

int main(int argc, char *argv[]) {
  App app{};

  SDL_AppResult result = app.init(argc, argv);
  if (result == SDL_APP_SUCCESS) {
    return 0;
  }
  if (result == SDL_APP_FAILURE) {
    return 1;
  }

  Defer app_shut_down = [&]() { app.onExit(result); };

  bool quitting{false};
  std::mutex quitting_mutex;
  std::condition_variable quitting_signal;
  SDL_EventType tick_event_type =
      static_cast<SDL_EventType>(SDL_RegisterEvents(1));
  if (!tick_event_type) {
    std::cout << "Failed to register an event -- " << SDL_GetError()
              << std::endl;
    return 1;
  }

  std::thread ticker([&]() {
    Clock::time_point last_tick_time = Clock::now();
    SDL_CommonEvent tick_event;
    tick_event.type = tick_event_type;

    std::unique_lock quitting_lock{quitting_mutex};
    while (true) {
      Clock::time_point next_tick_time = last_tick_time + TICK_PERIOD;
      if (quitting_signal.wait_until(quitting_lock, next_tick_time,
                                     [&]() { return quitting; })) {
        break;
      }
      std::cout << "queuing tick..." << std::endl;
      SDL_PushEvent(reinterpret_cast<SDL_Event *>(&tick_event));
      last_tick_time = next_tick_time;
    }
  });

  while (true) {
    SDL_Event event;
    if (SDL_WaitEvent(&event)) {
      if (event.type == tick_event_type) {
        result = app.onTick();
      } else {
        result = app.onEvent(&event);
      }
    }
    if (result != SDL_APP_CONTINUE) {
      std::scoped_lock quitting_lock{quitting_mutex};
      quitting = true;
      break;
    }
  }
  quitting_signal.notify_one();

  ticker.join();

  return result == SDL_APP_SUCCESS ? 0 : 1;
}
