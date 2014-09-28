
/**
 @license $indexedDBProvider
 (c) 2014 Bram Whillock (bramski)
 Forked from original work by clements Capitan (webcss)
 License: MIT
 */

(function() {
  'use strict';
  var IDBKeyRange, indexedDB,
    __slice = [].slice;

  indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

  IDBKeyRange = window.IDBKeyRange || window.mozIDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

  angular.module('indexedDB', []).provider('$indexedDB', function() {
    var apiDirection, applyNeededUpgrades, cursorDirection, db, dbMode, dbName, dbPromise, dbVersion, defaultQueryOptions, errorMessageFor, readyState, upgradesByVersion;
    dbMode = {
      readonly: "readonly",
      readwrite: "readwrite"
    };
    readyState = {
      pending: "pending"
    };
    cursorDirection = {
      next: "next",
      nextunique: "nextunique",
      prev: "prev",
      prevunique: "prevunique"
    };
    apiDirection = {
      ascending: cursorDirection.next,
      descending: cursorDirection.prev
    };
    dbName = '';
    dbVersion = 1;
    db = null;
    upgradesByVersion = {};
    dbPromise = null;
    defaultQueryOptions = {
      useIndex: void 0,
      keyRange: null,
      direction: cursorDirection.next
    };
    applyNeededUpgrades = (function(_this) {
      return function(oldVersion, event, db, tx) {
        var version;
        for (version in upgradesByVersion) {
          if (!upgradesByVersion.hasOwnProperty(version) || version <= oldVersion) {
            continue;
          }
          console.debug("$indexedDB: Running upgrade : " + version + " from " + oldVersion);
          upgradesByVersion[version](event, db, tx);
        }
      };
    })(this);
    errorMessageFor = function(e) {
      if (e.target.readyState === readyState.pending) {
        return "Error: Operation pending";
      } else {
        return e.target.webkitErrorMessage || e.target.error.message || e.target.errorCode;
      }
    };

    /**
    @ngdoc function
    @name $indexedDBProvider.connection
    @function
    
    @description
    sets the name of the database to use
    
    @param {string} databaseName database name.
    @returns {object} this
     */
    this.connection = function(databaseName) {
      dbName = databaseName;
      return this;
    };

    /**
    @ngdoc function
    @name $indexedDBProvider.upgradeDatabase
    @function
    
    @description provides version number and steps to upgrade the database wrapped in a
    callback function
    
    @param {number} newVersion new version number for the database.
    @param {function} callback the callback which proceeds the upgrade
    @returns {object} this
     */
    this.upgradeDatabase = function(newVersion, callback) {
      upgradesByVersion[newVersion] = callback;
      dbVersion = Math.max.apply(null, Object.keys(upgradesByVersion));
      return this;
    };
    this.$get = [
      '$q', '$rootScope', '$timeout', function($q, $rootScope, $timeout) {
        var DbQ, ObjectStore, Transaction, closeDatabase, createDatabaseConnection, keyRangeForOptions, openDatabase, openTransaction, rejectWithError, validateStoreNames;
        rejectWithError = function(deferred) {
          return function(error) {
            return $rootScope.$apply(function() {
              return deferred.reject(errorMessageFor(error));
            });
          };
        };
        createDatabaseConnection = function() {
          var dbReq, deferred;
          deferred = $q.defer();
          dbReq = indexedDB.open(dbName, dbVersion || 1);
          dbReq.onsuccess = function() {
            db = dbReq.result;
            $rootScope.$apply(function() {
              deferred.resolve(db);
            });
          };
          dbReq.onblocked = dbReq.onerror = rejectWithError(deferred);
          dbReq.onupgradeneeded = function(event) {
            var tx;
            db = event.target.result;
            tx = event.target.transaction;
            console.debug("$indexedDB: Upgrading database '" + db.name + "' from version " + event.oldVersion + " to version " + event.newVersion + " ...");
            applyNeededUpgrades(event.oldVersion, event, db, tx);
          };
          return deferred.promise;
        };
        openDatabase = function() {
          return dbPromise || (dbPromise = createDatabaseConnection());
        };
        closeDatabase = function() {
          return openDatabase().then(function() {
            db.close();
            db = null;
            return dbPromise = null;
          });
        };
        validateStoreNames = function(storeNames) {
          return db.objectStoreNames.contains(storeNames);
        };
        openTransaction = function(storeNames, mode) {
          if (mode == null) {
            mode = dbMode.readonly;
          }
          return openDatabase().then(function() {
            if (!validateStoreNames(storeNames)) {
              return $q.reject("Object stores " + storeNames + " do not exist.");
            }
            return new Transaction(storeNames, mode);
          });
        };
        keyRangeForOptions = function(options) {
          if (options.beginKey && options.endKey) {
            return IDBKeyRange.bound(options.beginKey, options.endKey);
          }
        };
        Transaction = (function() {
          function Transaction(storeNames, mode) {
            if (mode == null) {
              mode = dbMode.readonly;
            }
            this.transaction = db.transaction(storeNames, mode);
            this.defer = $q.defer();
            this.promise = this.defer.promise;
            this.resultValues = [];
            this.setupCallbacks();
          }

          Transaction.prototype.setupCallbacks = function() {
            this.transaction.oncomplete = (function(_this) {
              return function() {
                return $rootScope.$apply(function() {
                  return _this.defer.resolve("Transaction Completed");
                });
              };
            })(this);
            this.transaction.onabort = (function(_this) {
              return function(error) {
                return $rootScope.$apply(function() {
                  return _this.defer.reject("Transaction Aborted", error);
                });
              };
            })(this);
            return this.transaction.onerror = (function(_this) {
              return function(error) {
                return $rootScope.$apply(function() {
                  return _this.defer.reject("Transaction Error", error);
                });
              };
            })(this);
          };

          Transaction.prototype.objectStore = function(storeName) {
            return this.transaction.objectStore(storeName);
          };

          Transaction.prototype.abort = function() {
            return this.transaction.abort();
          };

          return Transaction;

        })();
        DbQ = (function() {
          function DbQ() {
            this.q = $q.defer();
            this.promise = this.q.promise;
          }

          DbQ.prototype.reject = function() {
            var args;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            return $rootScope.$apply((function(_this) {
              return function() {
                var _ref;
                return (_ref = _this.q).reject.apply(_ref, args);
              };
            })(this));
          };

          DbQ.prototype.rejectWith = function(req) {
            return req.onerror = req.onblocked = (function(_this) {
              return function(e) {
                return _this.reject(errorMessageFor(e));
              };
            })(this);
          };

          DbQ.prototype.resolve = function() {
            var args;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            return $rootScope.$apply((function(_this) {
              return function() {
                var _ref;
                return (_ref = _this.q).resolve.apply(_ref, args);
              };
            })(this));
          };

          DbQ.prototype.notify = function() {
            var args;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            return $rootScope.$apply((function(_this) {
              return function() {
                var _ref;
                return (_ref = _this.q).notify.apply(_ref, args);
              };
            })(this));
          };

          DbQ.prototype.notifyWith = function(req) {
            return req.onnotify = (function(_this) {
              return function(e) {
                console.log("notify", e);
                return _this.notify(e.target.result);
              };
            })(this);
          };

          DbQ.prototype.dbErrorFunction = function() {
            return (function(_this) {
              return function(error) {
                return $rootScope.$apply(function() {
                  return _this.q.reject(errorMessageFor(error));
                });
              };
            })(this);
          };

          DbQ.prototype.resolveWith = function(req) {
            this.notifyWith(req);
            this.rejectWith(req);
            return req.onsuccess = (function(_this) {
              return function(e) {
                return _this.resolve(e.target.result);
              };
            })(this);
          };

          return DbQ;

        })();
        ObjectStore = (function() {
          function ObjectStore(storeName, transaction) {
            this.storeName = storeName;
            this.store = transaction.objectStore(storeName);
            this.transaction = transaction;
          }

          ObjectStore.prototype.defer = function() {
            return new DbQ();
          };

          ObjectStore.prototype._mapCursor = function(defer, mapFunc, req) {
            var results;
            if (req == null) {
              req = this.store.openCursor();
            }
            results = [];
            defer.rejectWith(req);
            return req.onsuccess = function(e) {
              var cursor;
              if (cursor = e.target.result) {
                results.push(mapFunc(cursor));
                defer.notify(mapFunc(cursor));
                return cursor["continue"]();
              } else {
                return defer.resolve(results);
              }
            };
          };

          ObjectStore.prototype._arrayOperation = function(data, mapFunc) {
            var defer, item, req, results, _i, _len;
            defer = this.defer();
            if (!angular.isArray(data)) {
              data = [data];
            }
            for (_i = 0, _len = data.length; _i < _len; _i++) {
              item = data[_i];
              req = mapFunc(item);
              results = [];
              defer.notifyWith(req);
              defer.rejectWith(req);
              req.onsuccess = function(e) {
                results.push(e.target.result);
                if (results.length >= data.length) {
                  return defer.resolve(results);
                }
              };
            }
            if (data.length === 0) {
              $timeout(function() {
                return defer.resolve([]);
              }, 0);
            }
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.getAllKeys
            @function
          
            @description
            gets all the keys
          
            @returns {Q} A promise which will result with all the keys
           */

          ObjectStore.prototype.getAllKeys = function() {
            var defer, req;
            defer = this.defer();
            if (this.store.getAllKeys) {
              req = this.store.getAllKeys();
              defer.resolveWith(req);
            } else {
              this._mapCursor(defer, function(cursor) {
                return cursor.key;
              });
            }
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.clear
            @function
          
            @description
            clears all objects from this store
          
            @returns {Q} A promise that this can be done successfully.
           */

          ObjectStore.prototype.clear = function() {
            var defer, req;
            defer = this.defer();
            req = this.store.clear();
            defer.resolveWith(req);
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.delete
            @function
          
            @description
            Deletes the item at the key.  The operation is ignored if the item does not exist.
          
            @param {key} The key of the object to delete.
            @returns {Q} A promise that this can be done successfully.
           */

          ObjectStore.prototype["delete"] = function(key) {
            var defer;
            defer = this.defer();
            defer.resolveWith(this.store["delete"](key));
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.upsert
            @function
          
            @description
            Updates the given item
          
            @param {data} Details of the item or items to update or insert
            @returns {Q} A promise that this can be done successfully.
           */

          ObjectStore.prototype.upsert = function(data) {
            return this._arrayOperation(data, (function(_this) {
              return function(item) {
                return _this.store.put(item);
              };
            })(this));
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.insert
            @function
          
            @description
            Updates the given item
          
            @param {data} Details of the item or items to insert
            @returns {Q} A promise that this can be done successfully.
           */

          ObjectStore.prototype.insert = function(data) {
            return this._arrayOperation(data, (function(_this) {
              return function(item) {
                return _this.store.add(item);
              };
            })(this));
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.getAll
            @function
          
            @description
            Fetches all items from the store
          
            @returns {Q} A promise which resolves with copies of all items in the store
           */

          ObjectStore.prototype.getAll = function() {
            var defer;
            defer = this.defer();
            if (this.store.getAll) {
              defer.resolveWith(this.store.getAll());
            } else {
              this._mapCursor(defer, function(cursor) {
                return cursor.value;
              });
            }
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.each
            @function
          
            @description
            Iterates through the items in the store
          
            @param {options.beginKey} the key to start iterating from
            @param {options.endKey} the key to stop iterating at
            @param {options.direction} Direction to iterate in
            @returns {Q} A promise which notifies with each individual item and resolves with all of them.
           */

          ObjectStore.prototype.each = function(options) {
            if (options == null) {
              options = {};
            }
            return this.eachBy(void 0, options);
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.eachBy
            @function
          
            @description
            Iterates through the items in the store using an index
          
            @param {indexName} name of the index to use instead of the primary
            @param {options.beginKey} the key to start iterating from
            @param {options.endKey} the key to stop iterating at
            @param {options.direction} Direction to iterate in
            @returns {Q} A promise which notifies with each individual item and resolves with all of them.
           */

          ObjectStore.prototype.eachBy = function(indexName, options) {
            var defer, direction, keyRange, req;
            if (indexName == null) {
              indexName = void 0;
            }
            if (options == null) {
              options = {};
            }
            keyRange = keyRangeForOptions(options);
            direction = options.direction || defaultQueryOptions.direction;
            defer = this.defer();
            req = indexName ? this.store.index(indexName).openCursor(keyRange, direction) : this.store.openCursor(keyRange, direction);
            this._mapCursor(defer, (function(cursor) {
              return cursor.value;
            }), req);
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.count
            @function
          
            @description
            Returns a count of the items in the store
          
            @returns {Q} A promise which resolves with the count of all the items in the store.
           */

          ObjectStore.prototype.count = function() {
            var defer;
            defer = this.defer();
            defer.resolveWith(this.store.count());
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.find
            @function
          
            @description
            Fetches an item from the store
          
            @returns {Q} A promise which resolves with the item from the store
           */

          ObjectStore.prototype.find = function(key) {
            var defer, req;
            defer = this.defer();
            req = this.store.get(key);
            defer.rejectWith(req);
            req.onsuccess = (function(_this) {
              return function(e) {
                if (e.target.result) {
                  return defer.resolve(e.target.result);
                } else {
                  return defer.reject("" + _this.storeName + ":" + key + " not found.");
                }
              };
            })(this);
            return defer.promise;
          };


          /**
            @ngdoc function
            @name $indexedDBProvider.store.findBy
            @function
          
            @description
            Fetches an item from the store using a named index.
          
            @returns {Q} A promise which resolves with the item from the store.
           */

          ObjectStore.prototype.findBy = function(index, key) {
            var defer;
            defer = this.defer();
            defer.resolveWith(this.store.index(index).get(key));
            return defer.promise;
          };

          return ObjectStore;

        })();
        return {

          /**
          @ngdoc method
          @name $indexedDB.objectStore
          @function
          
          @description an IDBObjectStore to use
          
          @params {string} storeName the name of the objectstore to use
          @returns {object} ObjectStore
           */
          openStore: function(storeName, callBack, mode) {
            if (mode == null) {
              mode = dbMode.readwrite;
            }
            return openTransaction([storeName], mode).then(function(transaction) {
              callBack(new ObjectStore(storeName, transaction));
              return transaction.promise;
            });
          },

          /**
            @ngdoc method
            @name $indexedDB.closeDatabase
            @function
          
            @description Closes the database for use and completes all transactions.
           */
          closeDatabase: function() {
            return closeDatabase();
          },

          /**
            @ngdoc method
            @name $indexedDB.deleteDatabase
            @function
          
            @description Closes and then destroys the current database.  Returns a promise that resolves when this is persisted.
           */
          deleteDatabase: function() {
            return closeDatabase().then(function() {
              var defer;
              defer = new DbQ();
              defer.resolveWith(indexedDB.deleteDatabase(dbName));
              return defer.promise;
            })["finally"](function() {
              return console.debug("$indexedDB: " + dbName + " database deleted.");
            });
          },
          queryDirection: apiDirection,

          /**
            @ngdoc method
            @name $indexedDB.databaseInfo
            @function
          
            @description Returns information about this database.
           */
          databaseInfo: function() {
            return openDatabase().then(function() {
              var storeNames, transaction;
              transaction = null;
              storeNames = Array.prototype.slice.apply(db.objectStoreNames);
              return openTransaction(storeNames, dbMode.readonly).then(function(transaction) {
                var store, storeName, stores;
                stores = (function() {
                  var _i, _len, _results;
                  _results = [];
                  for (_i = 0, _len = storeNames.length; _i < _len; _i++) {
                    storeName = storeNames[_i];
                    store = transaction.objectStore(storeName);
                    _results.push({
                      name: storeName,
                      keyPath: store.keyPath,
                      autoIncrement: store.autoIncrement,
                      indices: Array.prototype.slice.apply(store.indexNames)
                    });
                  }
                  return _results;
                })();
                return transaction.promise.then(function() {
                  return {
                    name: db.name,
                    version: db.version,
                    objectStores: stores
                  };
                });
              });
            });
          }
        };
      }
    ];
  });

}).call(this);

//# sourceMappingURL=angular-indexed-db.js.map
