#include <emscripten.h>
#include <string.h>

#include "lua.h"
#include "lualib.h"
#include "lauxlib.h"

/*
	TODO:
	- closures
*/

EMSCRIPTEN_KEEPALIVE
void luaStackDump (lua_State *L) {
	int i;
	int top = lua_gettop(L);
	for (i = 1; i <= top; i++) {  /* repeat for each level */
	int t = lua_type(L, i);
	switch (t) {

		case LUA_TSTRING:  /* strings */
		printf("`%s'", lua_tostring(L, i));
		break;

		case LUA_TBOOLEAN:  /* booleans */
		printf(lua_toboolean(L, i) ? "true" : "false");
		break;

		case LUA_TNUMBER:  /* numbers */
		printf("%g", lua_tonumber(L, i));
		break;

		default:  /* other values */
		printf("%s", lua_typename(L, t));
		break;

	}
	printf("  ");  /* put a separator */
	}
	printf("\n");  /* end the listing */
}

void throwError(lua_State* L, char* error, int errorSize) {
	const char* msg = lua_tostring(L, -1);
	memcpy((void*)error, (void*)msg, errorSize);
}

EMSCRIPTEN_KEEPALIVE
void luaError(lua_State* L, const char* msg) {
	luaL_error(L, msg);
}

EMSCRIPTEN_KEEPALIVE
int luaTypeError(lua_State* L, int arg, const char* tname) {
	return luaL_typeerror(L, arg, tname);
}

EMSCRIPTEN_KEEPALIVE
lua_State* luaNewState(void) {
	lua_State* L = luaL_newstate();
	luaL_openlibs(L);
	return L;
}

EMSCRIPTEN_KEEPALIVE
void luaCloseState(lua_State* L) {
	lua_close(L);
}

EMSCRIPTEN_KEEPALIVE
int luaLoad(lua_State* L, const char* source, size_t sourceLen, const char* name) {
	return luaL_loadbufferx(L, source, sourceLen, name, NULL);
}

EMSCRIPTEN_KEEPALIVE
int luaLoadString(lua_State* L, const char* source, size_t sourceLen, const char* name) {
	return luaL_loadbufferx(L, source, sourceLen, name, "t");
}

EMSCRIPTEN_KEEPALIVE
int luaPcall(lua_State* L, int nargs, int nresults, int msgh) {
	return lua_pcall(L, nargs, nresults, msgh);
}

EMSCRIPTEN_KEEPALIVE
int luaDoBuffer(lua_State* L, const char* source, size_t sourceLen, const char* name, char* error, int errorSize) {
	// load
	if ( luaL_loadbufferx(L, source, sourceLen, name, "t") ) {
		throwError(L, error, errorSize);
		return 1;
	}
	
	// run
	if ( lua_pcall(L, 0, 0, 0) ) {
		throwError(L, error, errorSize);
		return 1;
	}
	
	return 0;
}

EMSCRIPTEN_KEEPALIVE
void luaAddLibrary(lua_State* L, const char* name, const luaL_Reg* elements, int numElements) {
	lua_createtable(L, 0, numElements);
	luaL_setfuncs(L, elements, 0);
	
	lua_setglobal(L, name);
}

EMSCRIPTEN_KEEPALIVE
void luaPushValue(lua_State* L, int index) {
	lua_pushvalue(L, index);
}

static int js_function(lua_State* L) {
	int fn_i = lua_tointeger(L, lua_upvalueindex(1));
	
	return EM_ASM_INT({
		return Lua._functions[$0]($1)
	}, fn_i, L);
}

EMSCRIPTEN_KEEPALIVE
void luaPushFunction(lua_State* L, int index) {
	lua_pushinteger(L, index);
	lua_pushcclosure(L, &js_function, 1);
}

EMSCRIPTEN_KEEPALIVE
void luaAddFunction(lua_State* L, const char* name, lua_CFunction func) {
	lua_pushcfunction(L, func);
	lua_setglobal(L, name);
}

EMSCRIPTEN_KEEPALIVE
void luaSetGlobal(lua_State* L, const char* name) {
	lua_setglobal(L, name);
}

EMSCRIPTEN_KEEPALIVE
int luaPushGlobal(lua_State* L, const char* name) {
	return lua_getglobal(L, name);
}

EMSCRIPTEN_KEEPALIVE
int luaExecFunc(lua_State* L, int nArgs, int nRes, char* error, int errorSize) {
	if ( lua_pcall(L, nArgs, nRes, 0) ) {
		throwError(L, error, errorSize);
		return 1;
	}
	
	return 0;
}

/*
EMSCRIPTEN_KEEPALIVE
int luaExecFuncPtr(lua_State* L, const void* ptr, int nArgs, int nRes, char* error, int errorSize) {
	const char* name = "somethingidk";
	
	if ( luaL_loadbuffer(L, ptr, 
	
	if ( lua_pcall(L, nArgs, nRes, 0) ) {
		throwError(L, error, errorSize);
		return 1;
	}
	
	return 0;
}
*/
EMSCRIPTEN_KEEPALIVE
int luaRef(lua_State* L) {
	return luaL_ref(L, LUA_REGISTRYINDEX);
}

EMSCRIPTEN_KEEPALIVE
void luaUnref(lua_State* L, int r) {
	luaL_unref(L, LUA_REGISTRYINDEX, r);
}

EMSCRIPTEN_KEEPALIVE
void luaPushRef(lua_State* L, int r) {
	lua_rawgeti(L, LUA_REGISTRYINDEX, r);
}

EMSCRIPTEN_KEEPALIVE
void luaRequireType(lua_State* L, int arg, int type) {
	luaL_checktype(L, arg, type);
}

EMSCRIPTEN_KEEPALIVE
int luaRequireInt(lua_State* L, int i) {
	return luaL_checkinteger(L, i);
}

EMSCRIPTEN_KEEPALIVE
double luaRequireNumber(lua_State* L, int i) {
	return luaL_checknumber(L, i);
}

EMSCRIPTEN_KEEPALIVE
const char* luaRequireString(lua_State* L, int i) {
	return luaL_checkstring(L, i);
}

EMSCRIPTEN_KEEPALIVE
void luaPushInt(lua_State* L, int v) {
	lua_pushinteger(L, v);
}

EMSCRIPTEN_KEEPALIVE
void luaPushNumber(lua_State* L, double v) {
	lua_pushnumber(L, v);
}

EMSCRIPTEN_KEEPALIVE
void luaPushBoolean(lua_State* L, int v) {
	lua_pushboolean(L, v);
}

EMSCRIPTEN_KEEPALIVE
void luaPushNil(lua_State* L, int v) {
	lua_pushnil(L);
}

EMSCRIPTEN_KEEPALIVE
void luaPushString(lua_State* L, const char* v) {
	lua_pushstring(L, v);
}

EMSCRIPTEN_KEEPALIVE
void luaPushLString(lua_State* L, const char* s, size_t length) {
	lua_pushlstring(L, s, length);
}

/*
EMSCRIPTEN_KEEPALIVE
void luaPushFString(lua_State* L, const char* fmt, ...) {
	lua_pushfstring()
}
*/

EMSCRIPTEN_KEEPALIVE
int luaCheckStack(lua_State* L, int sz) {
	return lua_checkstack(L, sz);
}

EMSCRIPTEN_KEEPALIVE
int luaIsNumber(lua_State* L, int i) {
	return lua_isnumber(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaIsInteger(lua_State* L, int i) {
	return lua_isinteger(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaIsBoolean(lua_State* L, int i) {
	return lua_isboolean(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaIsString(lua_State* L, int i) {
	return lua_isstring(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaIsNil(lua_State* L, int i) {
	return lua_isnil(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaGetInteger(lua_State* L, int i) {
	return lua_tointeger(L, i);
}

EMSCRIPTEN_KEEPALIVE
double luaGetNumber(lua_State* L, int i) {
	return lua_tonumber(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaGetBoolean(lua_State* L, int i) {
	return lua_toboolean(L, i);
}

EMSCRIPTEN_KEEPALIVE
const char* luaGetString(lua_State* L, int i) {
	return lua_tostring(L, i);
}

EMSCRIPTEN_KEEPALIVE
size_t luaGetStringLen(lua_State* L, int index) {
	return lua_rawlen(L, index);
}

EMSCRIPTEN_KEEPALIVE
lua_CFunction luaGetFuncPtr(lua_State* L, int i) {
	return lua_tocfunction(L, i);
}

EMSCRIPTEN_KEEPALIVE
const void* luaGetPointer(lua_State* L, int i) {
	return lua_topointer(L, i);
}

EMSCRIPTEN_KEEPALIVE
int luaGetType(lua_State* L, int i) {
	return lua_type(L, i);
}

EMSCRIPTEN_KEEPALIVE
void luaPop(lua_State* L, int i) {
	lua_pop(L, i);
}

EMSCRIPTEN_KEEPALIVE
void luaNewTable(lua_State* L) {
	lua_newtable(L);
}

EMSCRIPTEN_KEEPALIVE
void luaSetTable(lua_State* L, int index) {
	lua_settable(L, index);
}

EMSCRIPTEN_KEEPALIVE
void luaSetRegistry(lua_State* L) {
	lua_settable(L, LUA_REGISTRYINDEX);
}

EMSCRIPTEN_KEEPALIVE
void luaGetTable(lua_State* L, int index) {
	lua_gettable(L, index);
}

EMSCRIPTEN_KEEPALIVE
void luaGetRegistry(lua_State* L) {
	lua_gettable(L, LUA_REGISTRYINDEX);
}

EMSCRIPTEN_KEEPALIVE
int luaIsTable(lua_State* L, int index) {
	return lua_istable(L, index);
}

EMSCRIPTEN_KEEPALIVE
void luaRawGeti(lua_State* L, int index, int key) {
	lua_rawgeti(L, index, key);
}

/*
EMSCRIPTEN_KEEPALIVE
void luaRawGetiReg(lua_State* L, int key) {
	lua_rawgeti(L, LUA_REGISTRYINDEX, key);
}
*/

EMSCRIPTEN_KEEPALIVE
void luaRawSeti(lua_State* L, int index, int key) {
	lua_rawseti(L, index, key);
}

/*
EMSCRIPTEN_KEEPALIVE
void luaRawSetiReg(lua_State* L, int key) {
	lua_rawseti(L, LUA_REGISTRYINDEX, key);
}
*/

EMSCRIPTEN_KEEPALIVE
void luaRawGet(lua_State* L, int index) {
	lua_rawget(L, index);
}

EMSCRIPTEN_KEEPALIVE
void luaRawGetRegistry(lua_State* L) {
	lua_rawget(L, LUA_REGISTRYINDEX);
}

EMSCRIPTEN_KEEPALIVE
void luaRawSet(lua_State* L, int index) {
	lua_rawset(L, index);
}

EMSCRIPTEN_KEEPALIVE
void luaRawSetRegistry(lua_State* L) {
	lua_rawset(L, LUA_REGISTRYINDEX);
}

EMSCRIPTEN_KEEPALIVE
void* luaNewUserdata(lua_State* L, size_t size) {
	return lua_newuserdata(L, size);
}

EMSCRIPTEN_KEEPALIVE
void* luaGetUserdata(lua_State* L, int index) {
	return lua_touserdata(L, index);
}

EMSCRIPTEN_KEEPALIVE
int luaNewMetatable(lua_State* L, const char* tname) {
	return luaL_newmetatable(L, tname);
}

EMSCRIPTEN_KEEPALIVE
void luaGetMetatable(lua_State* L, const char* tname) {
	luaL_getmetatable(L, tname);
}

EMSCRIPTEN_KEEPALIVE
int luaGetMetatableFromValue(lua_State* L, int index) {
	return lua_getmetatable(L, index);
}

EMSCRIPTEN_KEEPALIVE
void* luaCheckUserdata(lua_State* L, int index, const char* tname) {
	return luaL_checkudata(L, index, tname);
}

EMSCRIPTEN_KEEPALIVE
void luaSetMetatable(lua_State* L, int index) {
	lua_setmetatable(L, index);
}

EMSCRIPTEN_KEEPALIVE
void luaPushLightUserdata(lua_State* L, void* p) {
	lua_pushlightuserdata(L, p);
}

EMSCRIPTEN_KEEPALIVE
int luaGetMetafield(lua_State* L, int obj, const char* e) {
	return luaL_getmetafield(L, obj, e);
}

EMSCRIPTEN_KEEPALIVE
void luaGetField(lua_State* L, int index, const char* k) {
	lua_getfield(L, index, k);
}

EMSCRIPTEN_KEEPALIVE
void luaSetField(lua_State* L, int index, const char* k) {
	lua_setfield(L, index, k);
}

EMSCRIPTEN_KEEPALIVE
lua_State* luaNewThread(lua_State* L) {
	return lua_newthread(L);
}