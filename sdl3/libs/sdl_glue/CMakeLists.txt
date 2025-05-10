add_library(sdl_glue STATIC)
target_sources(sdl_glue
  PUBLIC FILE_SET sdl_glue TYPE CXX_MODULES
  BASE_DIRS
    interface
  FILES
    interface/sdl_glue/app.cxx
    interface/sdl_glue/main.cxx
)
target_link_libraries(sdl_glue
  PUBLIC
    SDL3::SDL3
)
