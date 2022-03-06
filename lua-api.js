/******************************************************************************
* 						    LUA COPYRIGHT NOTICE
*==============================================================================
* Copyright (C) 1994-2021 Lua.org, PUC-Rio.
*
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
******************************************************************************/

function allocString(str) {
	var alloc = _malloc(str.length + 1);
	stringToUTF8(str, alloc, str.length + 1);
	return alloc;
}

function createLibraryData(libData) {
	var numFunctions = Object.keys(libData).length;
	var allocLen = (numFunctions + 1) * 8; // functions in libData, + 1 sentinent value (completely null)
	var alloc = _malloc(allocLen);

	if (alloc === 0) {
		throw new Error("Allocation failed");
	}

	var view = new DataView(wasmMemory.buffer, alloc, allocLen);

	let i = 0;
	for (let name in libData) {
		let func = libData[name];

		let c_name = allocString(name);
		let f_ptr = addFunction(func, "ii");

		view.setInt32(i, c_name, true);
		i += 4;
		view.setInt32(i, f_ptr, true);
		i += 4;
	}

	// create sentinel values
	view.setInt32(i, 0, true);
	i += 4;
	view.setInt32(i, 0, true);
	i += 4;

	return {
		numFunctions: numFunctions,
		data: alloc
	};
}

var luaStates = new Map();
Lua._functions = {};
Lua._nfunctions = 0;
const LUA_MAX_FUNCTIONS = 2048;

function allocFunction(func) {
	if (Lua._nfunctions >= LUA_MAX_FUNCTIONS) {
		throw new RangeError("Num functions exceeded");
	}
	
	let ptr;
	
	do {
		ptr = Math.floor(Math.random() * LUA_MAX_FUNCTIONS);
	} while (ptr in Lua._functions);
	
	Lua._nfunctions++;
	
	Lua._functions[ptr] = func;
	
	return ptr;
}

function deallocFunction(ptr) {
	if (ptr in Lua._functions) {
		delete Lua._functions[ptr];
		Lua._nfunctions--;
	}
}

function clearFunctions() {
	Lua._functions = {};
	Lua._nfunctions = 0;
}

Lua.clearFunctionTable = clearFunctions
Lua.deallocFunction = deallocFunction
Lua.clearFunctionTable = clearFunctions
Lua.TNONE = -1;
Lua.TNIL = 0;
Lua.TBOOLEAN = 1;
Lua.TLIGHTUSERDATA = 2;
Lua.TNUMBER = 3;
Lua.TSTRING = 4;
Lua.TTABLE = 5;
Lua.TFUNCTION = 6;
Lua.TUSERDATA = 7;
Lua.TTHREAD = 8;

class LuaUserdata {
}

class LuaError extends Error {
	constructor(msg) {
		super(msg);
		this.name = "LuaError";
	}
}

class LuaState {
	constructor(parent) {
		if (parent && !(parent instanceof LuaState)) {
			throw new TypeError("Expected parent LuaState");
		}
		
		this.parent = parent || null;
		
		if (parent) {
			this.L = _luaNewThread(parent.L);
			this.userdatas = parent.userdatas;
		} else {
			this.L = _luaNewState();
			this.userdatas = new Map();
		}
		
		this._closed = false;
		luaStates.set(this.L, this);
	}

	/**
	* Closes this state. Make sure to call this when you are finished with it.
	*/
	close() {
		if (this._closed) {
			throw new Error("Lua.State is already closed");
		}
		
		this._closed = true;
		
		if (!this.parent) _luaCloseState(this.L);
		
		luaStates.delete(this.L);
		//this.unlinkAllUserdata();
	}

	pushNil() {
		_luaPushNil(this.L);
	}

	pushString(str) {
		var ptr = allocString(str);
		_luaPushLString(this.L, ptr, str.length);
		_free(ptr);
	}

	isString(index) {
		return _luaIsString(this.L, index) !== 0;
	}

	pushInt(val) {
		_luaPushInt(this.L, val);
	}

	isInt(index) {
		return _luaIsInteger(this.L, index) !== 0;
	}

	pushNumber(val) {
		_luaPushNumber(this.L, val);
	}

	isNumber(index) {
		return _luaIsNumber(this.L, index) !== 0;
	}

	pushBoolean(val) {
		_luaPushBoolean(this.L, val);
	}

	isBoolean(index) {
		return _luaIsBoolean(this.L, index) !== 0;
	}

	isNil(index) {
		return _luaIsNil(this.L, index) !== 0;
	}

	pushGlobal(name) {
		var c_str = allocString(name);
		_luaPushGlobal(this.L, c_str);
		_free(c_str);
	}

	// push a value from the stack onto the top
	pushFromStack(index) {
		_luaPushValue(this.L, index);
	}

	/**
	* Pushes a function onto the stack.
	* @param {function} func The function to push
	* @returns The pointer to the function
	*/
	pushFunction(func) {
		var f_ptr = allocFunction(L_ptr => func(luaStates.get(L_ptr)), "ii");
		_luaPushFunction(this.L, f_ptr);
		return f_ptr
	}

	setGlobal(name) {
		var c_str = allocString(name);
		_luaSetGlobal(this.L, c_str);
		_free(c_str);
	}

	checkNumber(index) {
		return _luaRequireNumber(this.L, index);
	}

	getNumber(index) {
		return _luaGetNumber(this.L, index);
	}

	checkInt(index) {
		return _luaRequireInt(this.L, index);
	}

	getInt(index) {
		return _luaGetInteger(this.L, index);
	}

	checkBoolean(index) {
		return _luaRequireBoolean(this.L, index);
	}

	getBoolean(index) {
		return _luaGetBoolean(this.L, index);
	}

	checkString(index) {
		var c_str = _luaRequireString(this.L, index);

		return c_str === 0 ? null : UTF8ToString(c_str);
	}

	getString(index) {
		var c_str = _luaGetString(this.L, index);

		return c_str === 0 ? null : UTF8ToString(c_str);
	}

	throwError(msg) {
		var ptr = allocString(msg);
		_luaError(this.L, ptr);
		_free(ptr);
	}

	throwTypeError(arg, name) {
		var ptr = allocString(name);
		_luaTypeError(this.L, arg, ptr);
		_free(ptr);
	}

	getType(index) {
		return _luaGetType(this.L, index)
	}

	addLibrary(name, libData) {
		var c_name = allocString(name);
		var lib = createLibraryData(libData);
		_luaAddLibrary(this.L, c_name, lib.data, lib.numFunctions);
		_free(c_name);
	}

	addFunction(name, f) {
		/*
		var c_name = allocString(name);
		var f_ptr = allocFunction(L_ptr => f(luaStates.get(L_ptr)));

		_luaAddFunction(this.L, c_name, f_ptr);

		_free(c_name);*/
		var ptr = this.pushFunction(f);
		this.setGlobal(name);
		
		return ptr;
	}
	
	/**
	* Parses a string or bytecode into a Lua chunk
	* @param {string} src The source code of the chunk
	* @param {string} name The name used to identify the chunk
	*/
	load(src, name) {
		const srcBuffer = _malloc(src.length + 1);
		stringToUTF8(src, srcBuffer, src.length + 1);
		
		const nameBuffer = _malloc(name.length + 1);
		stringToUTF8(name, nameBuffer, name.length + 1);
		
		const errno = _luaLoad(this.L, srcBuffer, src.length, nameBuffer);
		
		_free(srcBuffer);
		_free(nameBuffer);
		
		if (errno !== 0) {
			let err = new LuaError(this.getString(-1));
			this.pop(1);
			
			throw err;
		}
	}
	
	/**
	* Parses a string into a Lua chunk
	* @param {string} src The source code of the chunk
	* @param {string} name The name used to identify the chunk
	*/
	loadString(src, name) {
		const srcBuffer = _malloc(src.length + 1);
		stringToUTF8(src, srcBuffer, src.length + 1);
		
		const nameBuffer = _malloc(name.length + 1);
		stringToUTF8(name, nameBuffer, name.length + 1);
		
		const errno = _luaLoadString(this.L, srcBuffer, src.length, nameBuffer);
		
		_free(srcBuffer);
		_free(nameBuffer);
		
		if (errno !== 0) {
			let err = new LuaError(this.getString(-1));
			this.pop(1);
			
			throw err;
		}
	}

	runCode(code, name) {
		const bufferSize = 256;
		const errorBuffer = _malloc(bufferSize);

		const codeBuffer = _malloc(code.length);
		stringToUTF8(code, codeBuffer, code.length);

		const nameSize = name.length + 1;
		const nameBuffer = _malloc(nameSize);
		stringToUTF8(code, nameBuffer, nameSize);
		
		const failure = _luaDoBuffer(this.L, codeBuffer, code.length, nameBuffer, errorBuffer, bufferSize);
		var err_str;

		if (failure !== 0) {
			err_str = UTF8ToString(errorBuffer);
		}

		_free(errorBuffer);
		_free(codeBuffer);
		_free(nameBuffer);

		if (failure !== 0) {
			throw new Error(err_str);
		}
	}

	runFunc(args, nRes) {
		// push arguments onto stack
		var n_args = 0;
		
		if (args) {
			n_args = args.length / 2;
			
			for (let i = 0; i < args.length; i += 2) {
				let type = args[i];
				let val = args[i + 1];

				switch (type) {
					case "int":
						this.pushInt(val);
						break;
					case "number":
						this.pushNumber(val);
						break;
					case "boolean":
						this.pushBoolean(val);
						break;
					case "string":
						this.pushString(val);
						break;
					default:
						throw new TypeError("Invalid type " + type);
				}
			}
		}
		
		// execute function
		const fail = _luaPcall(this.L, n_args, nRes, 0);

		if (fail !== 0) {
			let err = new LuaError(this.getString(-1));
			this.pop(1);
			
			throw err;
		}
	}

	loadFunc(name, args, nRes) {
		// push function onto stack
		const c_name = allocString(name);
		_luaPushGlobal(this.L, c_name);
		_free(c_name);

		this.runFunc(this.L, nRes);
	}

	createTable() {
		_luaNewTable(this.L);
	}

	setTable(index) {
		_luaSetTable(this.L, index);
	}

	getTable(index) {
		_luaGetTable(this.L, index);
	}

	setRegistry() {
		_luaSetRegistry(this.L);
	}

	getRegistry() {
		_luaGetRegistry(this.L);
	}

	/**
	 * Checks if an item on the stack is the table
	 * @param {number} index the index of the item relative to the top of the stack 
	 * @returns {boolean}
	 */
	isTable(index) {
		return _luaIsTable(this.L, index);
	}

	rawGet(index) {
		_luaRawGet(this.L, index);
	}

	rawSet(index) {
		_luaRawSet(this.L, index);
	}

	rawGetInteger(index, key) {
		_luaRawGeti(this.L, index, key);
	}

	rawSetInteger(index, key) {
		_luaRawSeti(this.L, index, key);
	}

	/**
	 * Creates a userdata
	 * @param {object} struct an object with keys as key names, and values as their key types 
	 * @returns a LuaUserdata with key/values specified in struct
	 */
	createUserdata(struct, align = true) {
		var size = 0;

		var indices = {};

		for (let k in struct) {
			let t = struct[k];

			let ptr = size;
			let elem_size;

			switch (t) {
				case "int":
					elem_size = 4;
					break;
				case "number":
					elem_size = 8;
					break;
				case "boolean":
					elem_size = 4;
					break;
				default: // "string" + string_len (e.g. string64, string5)
					if (t.slice(0, 6) !== "string") {
							throw new TypeError("Invalid type " + t);
					}
					
					let len = +(t.slice(6));
					
					if (Number.isNaN(len)) {
						throw new TypeError("Invalid type " + t);
					}
					
					elem_size = len + 1;
					t = "string";
					break;
			}
			
			indices[k] = [size, t, elem_size];
			
			if (align) {
				// make sure elements are aligned
				size += Math.ceil(elem_size / 8) * 8;
			} else {
				size += elem_size;
			}
		}

		var ptr = _luaNewUserdata(this.L, size);
		var ud = new LuaUserdata();

		for (let k in indices) {
			let v = indices[k];

			let get_f, set_f;
			let type;
			let p = ptr + v[0];
			let elem_size = v[2];

			switch (v[1]) {
				case "int":
					type = "i32";
					break;

				case "boolean":
					type = "i32";
					break;

				case "number":
					type = "double";
					break;
					
				case "string":
					type = "string";
					break;
			}

			if (type === "string") {
				Object.defineProperty(ud, k, {
					get() {
						if (this.__freed__) throw new Error("Attempt to access data of unlinked userdata");
						return UTF8ToString(p, elem_size);
					},

					set(v) {
						if (this.__freed__) throw new Error("Attempt to access data of unlinked userdata");
						stringToUTF8(v, p, elem_size);
					}
				});
			} else {
				Object.defineProperty(ud, k, {
					get() {
						if (this.__freed__) throw new Error("Attempt to access data of unlinked userdata");
						return getValue(p, type);
					},

					set(v) {
						if (this.__freed__) throw new Error("Attempt to access data of unlinked userdata");
						setValue(p, v, type);
					}
				});
			}
		}

		ud.__ptr__ = ptr;
		ud.__freed__ = false;
		this.userdatas.set(ptr, ud);

		return ud;
	}

	/**
	 * Unlinks the userdata from the userdata register.
	 * Call this when the userdata is garbage collected.
	 * @param {LuaUserdata} data The userdata object to unlink 
	 */
	unlinkUserdata(data) {
		data.__freed__ = true;
		this.userdatas.delete(data.__ptr__);
	}

	unlinkAllUserdata() {
		for (let pair of this.userdatas) {
			pair[1].__freed__ = true;
		}
		
		this.userdatas.clear();
	}

	getUserdata(index) {
		return this.userdatas.get(_luaGetUserdata(this.L, index));
	}

	checkUserdata(index, tname) {
		var c_tname = allocString(tname);
		var ud = this.userdatas.get(_luaCheckUserdata(this.L, index, c_tname));
		_free(c_tname);

		return ud;
	}

	createMetatable(id) {
		var c_tname = allocString(id);
		_luaNewMetatable(this.L, c_tname);
		_free(c_tname);
	}

	setMetatable(index) {
		_luaSetMetatable(this.L, index);
	}

	getMetatable(index) {
		return _luaGetMetatableFromValue(this.L, index);
	}

	getMetafield(index, key) {
		var c_str = allocString(key);
		var s = _luaGetMetafield(this.L, index, c_str) !== 0;
		_free(c_str);
		return s;
	}

	pushMetatable(name) {
		var c_name = allocString(name);
		_luaGetMetatable(this.L, c_name);
		_free(c_name);
	}

	pushLightUserdata(ptr) {
		_luaPushLightUserdata(this.L, ptr);
	}

	/**
	* Dump the stack onto the console. Useful for debugging
	*/
	stackDump() {
		_luaStackDump(this.L);
	}

	/**
	 * Create a prototype metatable with the given items. The metatable is left on the stack.
	 * @param {string} id The unique identifier of the metatable
	 * @param {object} items The indicies of the metatable
	 */
	createPrototype(id, items) {
		this.createMetatable(id);

		// assign functions to metatable
		/*
			var lib = createLibraryData(items);
		console.log(lib);
			_luaAddLibrary(this.L, 0, lib.data, lib.numFunctions);
	    
			if (!("__index" in items)) {
		  // metatable.__index = metatable
		  
				this.pushString("__index");
				this.pushFromStack(-2);
		  
				// at this point, stack (hi->lo) = [metatable, "__index", metatable] 
				this.setTable(-3);
			}*/

		for (let k in items) {
			let v = items[k];

			this.pushFromStack(-1);
			this.pushString(k);

			if (v === "__SELF__") {
				this.pushFromStack(-2);
			} else {
				switch (typeof (v)) {
					case "function":
						this.pushFunction(v);
						break;
					case "number":
						if (v % 1 == 0) {
							this.pushInt(v);
						} else {
							this.pushNumber(v);
						}
						break;
					case "string":
						this.pushString(v);
						break;
				}
			}

			this.setTable(-3);
		}
	}

	/**
	* Pops n elements from the stack
	* @param {number} i How many items to pop
	*/
	pop(i) {
		_luaPop(this.L, i);
	}

	/**
	* Create a reference and returns its ID
	* @returns The ID reference
	*/
	ref() {
		return _luaRef(this.L);
	}
	
	/**
	* Unreferences an ID
	* @param {number} ref The ID to unreference
	*/
	unref(ref) {
		_luaUnref(this.L, ref);
	}

	/**
	* Pushes a reference onto the stack
	* @param ref {number} The ID to push onto the stack
	*/
	pushRef(ref) {
		_luaPushRef(this.L, ref);
	}
	
	/**
	* Forks a new thread
	* @returns A Lua.State representing the new thread
	*/
	fork() {
		return new LuaState(this);
	}
}

//var Lua = {};
Lua.createLibraryData = createLibraryData;
Lua.State = LuaState;
Lua.onprint = console.log;
Lua.onprinterr = console.error;

var readyListeners = [];

Lua.onready = function(f) {
	readyListeners.push(f);
}

Module.onRuntimeInitialized = function () {
	for (let listener of readyListeners) {
		listener();
	}
	
	readyListeners = null;
};