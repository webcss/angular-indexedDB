'use strict';

var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
var IDBKeyRange = window.IDBKeyRange  || window.mozIDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

angular.module('xc.indexedDB', []).provider('$indexedDB', function() {    
    var module = this,
    // transaction modes
        READONLY = "readonly", 
        READWRITE= "readwrite",
        VERSIONCHANGE = "versionchange",
    // cursor direction and skip behaviour
        NEXT = "next",
        NEXTUNIQUE = "nextunique",
        PREV = "prev",
        PREVUNIQUE = "prevunique";
      
    module.dbName = '';
    module.dbVersion = 1;
    module.db = null;
    
    module.onTransactionComplete = function(e) {
        console.log('Transaction completed.');
    };
    module.onTransactionAbort = function(e) {
        console.log('Transaction aborted: '+ e.target.webkitErrorMessage || e.target.errorCode);
    };
    module.onTransactionError = function(e) {
        console.log('Transaction failed: ' + e.target.errorCode);
    };
    module.onDatabaseError = function(e) {
        alert("Database error: " + e.target.webkitErrorMessage || e.target.errorCode);
    };   
    module.onDatabaseBlocked = function(e) {
        // If some other tab is loaded with the database, then it needs to be closed
        // before we can proceed.
        alert("Database is blocked. Try close other tabs with this page open and reload this page!");
    }; 
    
    module.connection = function(databaseName) {
        module.dbName = databaseName;
        return this;
    };
    module.upgradeDatabase = function(newVersion, callback) {
        module.dbVersion = newVersion;
        module.upgradeCallback = callback;
        return this;
    };  
    
    var successCallback = function(e) { return e.target.result; };
    
    module.$get = ['$q', function($q) {
        // default options for cursor queries
        var defaultQueryOptions = {
            useIndex: undefined,
            keyRange: null,
            direction: NEXT
        };
        // open specified database and return a promise
        var dbPromise = function() {
            var dbReq, defered = $q.defer();
            if(!module.db) {
                dbReq = indexedDB.open(module.dbName, module.dbVersion || 1);
                dbReq.onsuccess = function(e) {
                    module.db = dbReq.result;
                    defered.resolve(module.db);
                };
                dbReq.onblocked = module.onDatabaseBlocked;
                dbReq.onerror = module.onDatabaseError;
                dbReq.onupgradeneeded = function(e) {
                    var db = e.target.result, tx = e.target.transaction;
                    console.log('upgrading database "' + db.name + '" from version ' + e.oldVersion + ' to version ' + e.newVersion + '...');
                    module.upgradeCallback && module.upgradeCallback(e, db, tx);
                };
            } else {
                defered.resolve(module.db);
            }
            return defered.promise;
        };
                
        var ObjectStore = function(storeName) {
            this.storeName = storeName;
            this.transaction = undefined;
        };
        ObjectStore.prototype = {
            getObjectStore: function(storeName, mode) {
                var me = this;
                return dbPromise().then(function(db){
                    me.transaction = db.transaction([storeName], mode || READONLY);
                    me.transaction.oncomplete = module.onTransactionComplete;
                    me.transaction.onabort = module.onTransactionAbort;
                    me.onerror = module.onTransactionError;
                    return me.transaction.objectStore(storeName);
                });
            },
            abort: function() {
                if (this.transaction) {
                    this.transaction.abort();
                }
            },
            insert: function(data){
                return this.getObjectStore(this.storeName, READWRITE).then(function(store){
                    if (angular.isArray(data)) {
                        data.forEach(function(item){
                            store.add(item).onsuccess = successCallback;
                        });
                    } else {
                        store.add(data).onsuccess = successCallback;
                    }
                });                      
            },
            upsert: function(data){
                return this.getObjectStore(this.storeName, READWRITE).then(function(store){
                    if (angular.isArray(data)) {
                        data.forEach(function(item){
                            store.put(item).onsuccess = successCallback;
                        });
                    } else {
                        store.put(data).onsuccess = successCallback;
                    }
                });                      
            },
            delete: function(key) {
                return this.getObjectStore(this.storeName, READWRITE).then(function(store){
                    store.delete(key).onsuccess = successCallback;
                });
            },
            clear: function() {
                return this.getObjectStore(this.storeName, READWRITE).then(function(store){
                    store.clear().onsuccess = successCallback;
                });                
            },
            count: function() {
                return this.getObjectStore(this.storeName, READONLY).then(function(store){
                    return store.count();
                });
            },
            find: function(keyOrIndex, key){
                return this.getObjectStore(this.storeName, READONLY).then(function(store){
                    if(key) {
                        store.index(keyOrIndex).get(key).onsuccess = successCallback; 
                    } else {
                        store.get(keyOrIndex).onsuccess = successCallback;
                    }
                });
            },
            getAll: function() {
                var results = [], d = $q.defer();
                return this.getObjectStore(this.storeName, READONLY).then(function(store){
                    if (store.getAll) {         
                        store.getAll().onsuccess = successCallback;
                    } else {
                        store.openCursor().onsuccess = function(e) {
                            var cursor = e.target.result;
                            if(cursor){
                                results.push(cursor.value);
                                cursor.continue();
                            } else {
                                d.resolve(results);
                            }
                        };
                        return d.promise;
                    }
                });
            },
            each: function(options){
                return this.getObjectStore(this.storeName, READWRITE).then(function(store){
                   options = options || defaultQueryOptions;
                   if(options.useIndex) {
                        store.index(options.useIndex).openCursor(options.keyRange, options.direction).onsuccess = successCallback;
                    } else {
                        store.openCursor(options.keyRange, options.direction).onsuccess = successCallback;
                    }
                });
            }
        };
        
        // utitlity function to support keyRange definition for cursor queries
        var QueryBuilder = function() {
            this.result = defaultQueryOptions;
        };
        QueryBuilder.prototype = {
            $lt: function(value) {
                this.result.keyRange = IDBKeyRange.upperBound(value, true);
                return this;
            },
            $gt: function(value) {
                this.result.keyRange = IDBKeyRange.lowerBound(value, true);
                return this;
            },
            $lte: function(value) {
                this.result.keyRange = IDBKeyRange.upperBound(value);
                return this;
            },
            $gte: function(value) {
                this.result.keyRange = IDBKeyRange.lowerBound(value);
                return this;
            },
            $eq: function(value) {
                this.result.keyRange = IDBKeyRange.only(value);
                return this;
            },
            $between: function(lowValue, hiValue, exLow, exHi) {
                this.result.keyRange = IDBKeyRange.bound(lowValue, hiValue, exLow || false, exHi || false);
                return this;
            },
            $asc: function(unique) {
                this.result.order = (unique)? NEXTUNIQUE: NEXT;
                return this;
            },
            $desc: function(unique) {
                this.result.order = (unique)? PREVUNIQUE: PREV;
                return this;
            },
            useIndex: function(indexName) {
                this.result.useIndex = indexName;
                return this;
            },
            compile: function() {
                return this.result;
            }
        };
                
        // $indexedDB service itself ;-)
        return {
            objectStore: function(storeName) {
                return new ObjectStore(storeName);
            },
            getDbInfo: function() {
                var storeNames, stores = [], tx, store;
                return dbPromise().then(function(db){
                    storeNames = Array.prototype.slice.apply(db.objectStoreNames);
                    tx = db.transaction(storeNames, READONLY);
                    storeNames.forEach(function(storeName){
                        store = tx.objectStore(storeName);
                        stores.push({
                           name: storeName,
                           keyPath: store.keyPath,
                           autoIncrement: store.autoIncrement,
                           count: store.count(),
                           indices: Array.prototype.slice.apply(store.indexNames)
                        });
                    });
                    return {
                        name: db.name,
                        version: db.version,
                        objectStores: stores
                    };
                });
            },
            closeDB: function() {
                dbPromise().then(function(db){
                    db.close();
                });
            },
            switchDB: function(databaseName, version, upgradeCallback) {
                this.closeDB();
                module.db = null;
                module.dbName = databaseName;
                module.dbVersion = version || 1;
                module.upgradeCallback = upgradeCallback || function() {};
            },
            queryBuilder: function() {
                return QueryBuilder;
            }
        };
    }];
});
