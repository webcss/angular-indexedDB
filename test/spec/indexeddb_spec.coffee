'use strict'

describe "$indexedDB", ->
  providerConfig = {}
  $q = {}

  beforeEach ->
    angular.module('xc.indexedDB').config ($indexedDBProvider) ->
      providerConfig = $indexedDBProvider

    module 'xc.indexedDB'
    inject( -> )

  beforeEach inject ( $indexedDB, _$q_ ) ->
    @subject = $indexedDB
    $q = _$q_

  afterEach (done) ->
    @subject.dbInfo().then (info) =>
      $q.all(
        for store in info.objectStores
          @subject.objectStore(store.name).clear()
      ).then ->
        console.log("cleared")

  describe '#objectStore', ->
    beforeEach ->
      providerConfig.connection("testDB")
      .upgradeDatabase 1, (event, db, txn) ->
        db.createObjectStore "TestObjects", keyPath: 'id'

    it "returns the object store", (done) ->
      store = @subject.objectStore "TestObjects"
      store.getAllKeys().then (keys) ->
        expect( keys.length ).toEqual(0)
        done()

    it "throws an error for non-existent stores", (done) ->
      store = @subject.objectStore "NoSuchStore"
      store.getAllKeys().catch (problem) ->
        expect( problem ).toEqual("Object store NoSuchStore does not exist.")
        done()

    describe "#insert", ->
      store = {}
      beforeEach ->
        store = @subject.objectStore "TestObjects"

      describe "with a single item",
        beforeEach (done) ->
          store.insert({id: 1, data: "something"}).then (result) ->
            expect( result ).toBeTruthy()
            done()

        it "is in all items", (done) ->
          store.getAll().then (items) ->
            expect( items[0].id ).toEqual(1)
            expect( items[0].data ).toEqual("something")
            expect( items.length).toEqual(1)
            done()


