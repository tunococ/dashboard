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

set(vertex_shader_files
  shaders/vertex.glsl
)
set(fragment_shader_files
  shaders/fragment.glsl
)

set(shader_output_files)

macro(compile_shader_files list stage)
  foreach(sf IN LISTS ${list})
    message("Element: ${sf}")
    cmake_path(
      REMOVE_EXTENSION sf
      LAST_ONLY
      OUTPUT_VARIABLE sf_without_extension
    )
    cmake_path(
      ABSOLUTE_PATH sf_without_extension
      BASE_DIRECTORY ${CMAKE_BINARY_DIR}
      OUTPUT_VARIABLE sf_output_without_extension
    )
    set(sf_output ${sf_output_without_extension}.spv)

    cmake_path(
      REMOVE_FILENAME sf_output
      OUTPUT_VARIABLE sf_output_dir
    )

    add_custom_command(OUTPUT ${sf_output}
      COMMAND ${CMAKE_COMMAND} -E make_directory ${sf_output_dir}
      COMMAND glslc
        -fshader-stage=${stage}
        ${sf}
        -o ${sf_output}
      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )
    list(APPEND shader_output_files ${sf_output})
    message("input=${sf}")
    message("sf_without_extension=${sf_without_extension}")
    message("sf_output_without_extension=${sf_output_without_extension}")
    message("output=${sf_output}")
  endforeach()
endmacro()

compile_shader_files(vertex_shader_files vertex)
compile_shader_files(fragment_shader_files fragment)

add_custom_target(build_shaders
  COMMENT Compile shaders
  DEPENDS ${shader_output_files}
)

add_executable(dashboard)
target_sources(dashboard
  PRIVATE FILE_SET app TYPE CXX_MODULES
  FILES
    app.cppm
)
target_sources(dashboard
  PRIVATE
    main.cppm
)
target_link_libraries(dashboard
  sdl_glue
  utils
  SDL3::SDL3
)
add_dependencies(dashboard build_shaders)
