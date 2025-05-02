add_library(SdlApp INTERFACE) 
target_sources(SdlApp
  INTERFACE FILE_SET sdl_app TYPE HEADERS
  FILES
    interfaces/SdlApp.hpp
)
target_link_libraries(SdlApp
  INTERFACE
    SDL3::SDL3
)

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
    SdlApp
    SDL3::SDL3
)

