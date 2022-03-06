# luajs
webassembly lua runtime

current version: 5.4
- out/lua.js - the javascript runtime
- out/lua.wasm - the webassembly binary

## compiling
get the lua source code [here](https://www.lua.org/download.html)

compile with emscripten using the following command line arguments:
`-s ALLOW_TABLE_GROWTH=1 --post-js lua-api.js --pre-js pre.js`

put `var Lua = {};` on the top of the generated javascript file
