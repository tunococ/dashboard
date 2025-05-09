#include <utility>

template <class Func> class Defer {
public:
  Defer(Func &&func) : func_{std::forward<Func>(func)} {}
  ~Defer() { func_(); }

protected:
  Func func_;
};
