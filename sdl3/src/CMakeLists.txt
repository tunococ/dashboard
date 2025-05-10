add_library(dashboard_app STATIC)
target_sources(dashboard_app
  PUBLIC FILE_SET app TYPE CXX_MODULES
  FILES
    app.cxx
#    app.cpp
)
target_link_libraries(dashboard_app
  PRIVATE
    sdl_glue
    utils
    SDL3::SDL3
)

add_executable(dashboard)
target_sources(dashboard
  PRIVATE FILE_SET db TYPE CXX_MODULES
  FILES
    main.cpp
)
target_link_libraries(dashboard
  PRIVATE
    dashboard_app
    sdl_glue
    utils
    SDL3::SDL3
)

