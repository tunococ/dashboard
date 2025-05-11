add_library(utils STATIC)
target_sources(utils
  PUBLIC FILE_SET utils TYPE CXX_MODULES
  BASE_DIRS
    interface
  FILES
    interface/utils/defer.cppm
    interface/utils/main.cppm
)
