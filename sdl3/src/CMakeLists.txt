add_executable(dashboard)
target_sources(dashboard
  PRIVATE
    app.cpp
    main.cpp
  PRIVATE FILE_SET app_interface TYPE HEADERS
  FILES
    app.hpp
)
target_link_libraries(dashboard
  PRIVATE
    sdl_glue
    utils
    SDL3::SDL3
)
if(DEFINED SDL_ASSERT_LEVEL)
  target_compile_definitions(dashboard
    PRIVATE
      SDL_ASSERT_LEVEL=${SDL_ASSERT_LEVEL}
  )
  message(STATUS "SDL_ASSERT_LEVEL=${SDL_ASSERT_LEVEL}")
endif()

