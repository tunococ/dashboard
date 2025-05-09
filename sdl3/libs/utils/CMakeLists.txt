add_library(utils INTERFACE)
target_sources(utils
  INTERFACE FILE_SET utils_files TYPE HEADERS
  BASE_DIRS include
  FILES
    defer.hpp
)
