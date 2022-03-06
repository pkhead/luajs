Module.print = function(text) {
    Lua.onprint(text);
}

Module.printErr = function(text) {
    Lua.onprinterr(text);
}