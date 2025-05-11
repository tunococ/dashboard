add_library(dashboard_app STATIC)
target_sources(dashboard_app
  PUBLIC FILE_SET app TYPE CXX_MODULES
  FILES
    app.cppm
)
target_link_libraries(dashboard_app
  PRIVATE
    sdl_glue
    utils
    SDL3::SDL3
)

add_executable(dashboard)
target_sources(dashboard
  PRIVATE FILE_SET app TYPE CXX_MODULES
  FILES
    app.cppm
  PRIVATE
    main.cppm
)
target_link_libraries(dashboard
  sdl_glue
  utils
  SDL3::SDL3
)

add_executable(test test.cxx)
target_link_libraries(test utils)

