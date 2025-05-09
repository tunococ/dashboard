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
    SDL3::SDL3
)

