###*
 @license $indexedDBProvider
 (c) 2014 Bram Whillock (bramski)
 Forked from original work by clements Capitan (webcss)
 License: MIT
###

'use strict'

indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
IDBKeyRange = window.IDBKeyRange || window.mozIDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange

angular.module('indexedDB', []).provider '$indexedDB', ->
  dbMode =
    readonly: "readonly"
    readwrite: "readwrite"

  readyState =
    pending: "pending"

  cursorDirection =
    next: "next"
    nextunique: "nextunique"
    prev: "prev"
    prevunique: "prevunique"

  apiDirection =
    ascending: cursorDirection.next
    descending: cursorDirection.prev


  dbName = ''
  dbVersion = 1
  db = null
  upgradesByVersion = {}
  dbPromise = null
  defaultQueryOptions =
    useIndex: undefined
    keyRange: null
    direction: cursorDirection.next

  applyNeededUpgrades = (oldVersion, event, db, tx) =>
    for version of upgradesByVersion
      if not upgradesByVersion.hasOwnProperty(version) or version <= oldVersion
        continue
      console.debug "$indexedDB: Running upgrade : " + version + " from " + oldVersion
      upgradesByVersion[version] event, db, tx
    return

  errorMessageFor = (e) ->
    if e.target.readyState is readyState.pending
      "Error: Operation pending"
    else
      (e.target.webkitErrorMessage || e.target.error.message || e.target.errorCode)

  ###*
  @ngdoc function
  @name $indexedDBProvider.connection
  @function

  @description
  sets the name of the database to use

  @param {string} databaseName database name.
  @returns {object} this
  ###
  @connection = (databaseName) ->
    dbName = databaseName
    this


  ###*
  @ngdoc function
  @name $indexedDBProvider.upgradeDatabase
  @function

  @description provides version number and steps to upgrade the database wrapped in a
  callback function

  @param {number} newVersion new version number for the database.
  @param {function} callback the callback which proceeds the upgrade
  @returns {object} this
  ###
  @upgradeDatabase = (newVersion, callback) ->
    upgradesByVersion[newVersion] = callback
    dbVersion = Math.max.apply(null, Object.keys(upgradesByVersion))
    this

  @$get = ['$q', '$rootScope', '$timeout', ($q, $rootScope, $timeout) ->
    rejectWithError = (deferred) ->
      (error) ->
        $rootScope.$apply ->
          deferred.reject(errorMessageFor(error))

    createDatabaseConnection = ->
      deferred = $q.defer()
      dbReq = indexedDB.open(dbName, dbVersion or 1)
      dbReq.onsuccess = ->
        db = dbReq.result
        $rootScope.$apply ->
          deferred.resolve db
          return
        return
      dbReq.onblocked = dbReq.onerror = rejectWithError(deferred)
      dbReq.onupgradeneeded = (event) ->
        db = event.target.result
        tx = event.target.transaction
        console.debug "$indexedDB: Upgrading database '#{db.name}' from version #{event.oldVersion} to version #{event.newVersion} ..."
        applyNeededUpgrades event.oldVersion, event, db, tx
        return
      deferred.promise

    openDatabase = ->
      dbPromise ||= createDatabaseConnection()

    closeDatabase = ->
      openDatabase().then ->
        db.close()
        db = null
        dbPromise = null

    validateStoreNames = (storeNames) ->
      db.objectStoreNames.contains(storeNames)

    openTransaction = (storeNames, mode = dbMode.readonly) ->
      openDatabase().then ->
        unless validateStoreNames(storeNames)
          return $q.reject("Object stores " + storeNames + " do not exist.");
        new Transaction(storeNames, mode)

    keyRangeForOptions = (options) ->
      IDBKeyRange.bound(options.beginKey, options.endKey) if options.beginKey and options.endKey

    class Transaction
      constructor: (storeNames, mode = dbMode.readonly) ->
        @transaction = db.transaction(storeNames, mode)
        @defer = $q.defer()
        @promise = @defer.promise
        @resultValues = []
        @setupCallbacks()

      setupCallbacks: ->
        @transaction.oncomplete = =>
          $rootScope.$apply =>
            @defer.resolve("Transaction Completed")
        @transaction.onabort = (error) =>
          $rootScope.$apply =>
            @defer.reject("Transaction Aborted", error)
        @transaction.onerror = (error) =>
          $rootScope.$apply =>
            @defer.reject("Transaction Error", error)

      objectStore: (storeName) ->
        @transaction.objectStore(storeName)

      abort: ->
        @transaction.abort()

    class DbQ
      constructor: ->
        @q = $q.defer()
        @promise = @q.promise

      reject: (args...) ->
        $rootScope.$apply =>
          @q.reject(args...)

      rejectWith: (req) ->
        req.onerror = req.onblocked = (e) =>
          @reject(errorMessageFor(e))

      resolve: (args...) ->
        $rootScope.$apply =>
          @q.resolve(args...)

      notify: (args...) ->
        $rootScope.$apply =>
          @q.notify(args...)

      notifyWith: (req) ->
        req.onnotify = (e) =>
          console.log("notify", e)
          @notify(e.target.result)

      dbErrorFunction: ->
        (error) =>
          $rootScope.$apply =>
            @q.reject(errorMessageFor(error))

      resolveWith: (req) ->
        @notifyWith(req)
        @rejectWith(req)
        req.onsuccess = (e) =>
          @resolve(e.target.result)

    class ObjectStore
      constructor: (storeName, transaction) ->
        @storeName = storeName
        @store = transaction.objectStore(storeName)
        @transaction = transaction

      defer: ->
        new DbQ()

      _mapCursor: (defer, mapFunc, req = @store.openCursor()) ->
        results = []
        defer.rejectWith(req)
        req.onsuccess = (e) ->
          if cursor = e.target.result
            results.push(mapFunc(cursor))
            defer.notify(mapFunc(cursor))
            cursor.continue()
          else
            defer.resolve(results)

      _arrayOperation: (data, mapFunc) ->
        defer = @defer()
        data = [data] unless angular.isArray(data)
        for item in data
          req = mapFunc(item)
          results = []
          defer.notifyWith(req)
          defer.rejectWith(req)
          req.onsuccess = (e) ->
            results.push(e.target.result)
            defer.resolve(results) if results.length >= data.length
        if data.length == 0
          $timeout ->
            defer.resolve([])
          , 0
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.getAllKeys
        @function

        @description
        gets all the keys

        @returns {Q} A promise which will result with all the keys
        ###
      getAllKeys: ->
        defer = @defer()
        if @store.getAllKeys
          req = @store.getAllKeys()
          defer.resolveWith(req)
        else
          @_mapCursor defer, (cursor) ->
            cursor.key
        return defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.clear
        @function

        @description
        clears all objects from this store

        @returns {Q} A promise that this can be done successfully.
        ###
      clear: ->
        defer = @defer()
        req = @store.clear()
        defer.resolveWith(req)
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.delete
        @function

        @description
        Deletes the item at the key.  The operation is ignored if the item does not exist.

        @param {key} The key of the object to delete.
        @returns {Q} A promise that this can be done successfully.
        ###
      delete: (key) ->
        defer = @defer()
        defer.resolveWith(@store.delete(key))
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.upsert
        @function

        @description
        Updates the given item

        @param {data} Details of the item or items to update or insert
        @returns {Q} A promise that this can be done successfully.
        ###
      upsert: (data) ->
        @_arrayOperation data, (item) =>
          @store.put(item)

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.insert
        @function

        @description
        Updates the given item

        @param {data} Details of the item or items to insert
        @returns {Q} A promise that this can be done successfully.
        ###
      insert: (data) ->
        @_arrayOperation data, (item) =>
          @store.add(item)

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.getAll
        @function

        @description
        Fetches all items from the store

        @returns {Q} A promise which resolves with copies of all items in the store
        ###
      getAll: ->
        defer = @defer()
        if @store.getAll
          defer.resolveWith(@store.getAll())
        else
          @_mapCursor defer, (cursor) ->
            cursor.value
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.each
        @function

        @description
        Iterates through the items in the store

        @param {options.beginKey} the key to start iterating from
        @param {options.endKey} the key to stop iterating at
        @param {options.direction} Direction to iterate in
        @returns {Q} A promise which notifies with each individual item and resolves with all of them.
        ###
      each: (options = {}) ->
        @eachBy(undefined, options)

      ###*
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
        ###
      eachBy: (indexName = undefined, options = {}) ->
        keyRange = keyRangeForOptions options
        direction = options.direction || defaultQueryOptions.direction
        defer = @defer()
        req = if indexName
          @store.index(indexName).openCursor(keyRange, direction)
        else
          @store.openCursor(keyRange, direction)
        @_mapCursor(defer, ((cursor) ->
          cursor.value), req)
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.count
        @function

        @description
        Returns a count of the items in the store

        @returns {Q} A promise which resolves with the count of all the items in the store.
        ###
      count: ->
        defer = @defer()
        defer.resolveWith(@store.count())
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.find
        @function

        @description
        Fetches an item from the store

        @returns {Q} A promise which resolves with the item from the store
        ###
      find: (key) ->
        defer = @defer()
        req = @store.get(key)
        defer.rejectWith(req)
        req.onsuccess = (e) =>
          if e.target.result
            defer.resolve(e.target.result)
          else
            defer.reject("#{@storeName}:#{key} not found.")
        defer.promise

      ###*
        @ngdoc function
        @name $indexedDBProvider.store.findBy
        @function

        @description
        Fetches an item from the store using a named index.

        @returns {Q} A promise which resolves with the item from the store.
        ###
      findBy: (index, key) ->
        defer = @defer()
        defer.resolveWith(@store.index(index).get(key))
        defer.promise

    ###*
    @ngdoc method
    @name $indexedDB.objectStore
    @function

    @description an IDBObjectStore to use

    @params {string} storeName the name of the objectstore to use
    @returns {object} ObjectStore
    ###
    openStore: (storeName, callBack, mode = dbMode.readwrite) ->
      openTransaction([storeName], mode).then (transaction) ->
        callBack(new ObjectStore(storeName, transaction))
        transaction.promise

    ###*
      @ngdoc method
      @name $indexedDB.closeDatabase
      @function

      @description Closes the database for use and completes all transactions.
      ###
    closeDatabase: ->
      closeDatabase()

    ###*
      @ngdoc method
      @name $indexedDB.deleteDatabase
      @function

      @description Closes and then destroys the current database.  Returns a promise that resolves when this is persisted.
      ###
    deleteDatabase: ->
      closeDatabase().then ->
        defer = new DbQ()
        defer.resolveWith(indexedDB.deleteDatabase(dbName))
        defer.promise
      .finally ->
        console.debug "$indexedDB: #{dbName} database deleted."

    queryDirection: apiDirection

    ###*
      @ngdoc method
      @name $indexedDB.databaseInfo
      @function

      @description Returns information about this database.
      ###
    databaseInfo: ->
      openDatabase().then ->
        transaction = null
        storeNames = Array.prototype.slice.apply(db.objectStoreNames)
        openTransaction(storeNames, dbMode.readonly).then (transaction) ->
          stores = for storeName in storeNames
            store = transaction.objectStore(storeName)
            {
            name: storeName
            keyPath: store.keyPath
            autoIncrement: store.autoIncrement
            indices: Array.prototype.slice.apply(store.indexNames)
            }
          transaction.promise.then ->
            return {
            name: db.name
            version: db.version
            objectStores: stores
            }
  ]

  return
