add_library(sdl_glue INTERFACE)
target_sources(sdl_glue
  INTERFACE FILE_SET sdl_glue TYPE HEADERS
  BASE_DIRS
    include
  FILES
    include/sdl_glue/SdlApp.hpp
)
target_link_libraries(sdl_glue
  INTERFACE
    SDL3::SDL3
)
