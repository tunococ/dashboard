# SDL3 project

## Building

Set up the `build` directory for CMake and start configuring CMake:

```
cmake -B build --preset dev .
```

The option `--preset dev` will use the *configure preset* named `dev` defined
in [CMakePresets.json](CMakePresets.json).
Note that this preset requires [Ninja](https://ninja-build.org/),
so make sure Ninja is installed before building.
