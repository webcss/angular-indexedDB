'use strict'

describe "$indexedDB", ->
  providerConfig = {}
  $q = {}

  beforeEach ->
    angular.module('indexedDB').config ($indexedDBProvider) ->
      providerConfig = $indexedDBProvider

    module 'indexedDB'
    inject(->)

  itPromises = (message, testFunc) ->
    it message, (done) ->
      testFunc.apply(this, []).finally(done)

  promiseBefore = (beforeFunc) ->
    beforeEach (done) ->
      beforeFunc.apply(this, []).finally(done)

  beforeEach inject ($indexedDB, _$q_) ->
    @subject = $indexedDB
    $q = _$q_

  afterEach (done) ->
    @subject.deleteDatabase().finally(done)

  describe '#openStore', ->
    beforeEach ->
      providerConfig.connection("testDB")
      .upgradeDatabase 1, (event, db, txn) ->
        db.createObjectStore "TestObjects", keyPath: 'id'
      .upgradeDatabase 2, (event, db, txn) ->
        store = db.createObjectStore "ComplexTestObjects", keyPath: 'id'
        store.createIndex "name", "name", unique: false

    itPromises "returns the object store", ->
      @subject.openStore "TestObjects", (store) ->
        store.getAllKeys().then (keys) ->
          expect(keys.length).toEqual(0)

    itPromises "throws an error for non-existent stores", ->
      @subject.openStore("NoSuchStore", (->)).catch (problem) ->
        expect(problem).toEqual("Object stores NoSuchStore do not exist.")

    describe "#delete", ->
      promiseBefore ->
        @subject.openStore "TestObjects", (store) ->
          store.insert([
            {id: 1, data: "foo"},
            {id: 2, data: "bar"}
          ])

      itPromises "can delete an item", ->
        @subject.openStore "TestObjects", (store) ->
          store.delete(1)
          store.getAll().then (objects) ->
            expect(objects.length).toEqual(1)
            expect(objects[0].id).toEqual(2)

      itPromises "errors gracefully when it doesn't exist", ->
        @subject.openStore "TestObjects", (store) ->
          store.delete(55)
        .catch ->
          expect(true).toBeFalsy()

    describe "#find", ->
      promiseBefore ->
        @subject.openStore "TestObjects", (store) ->
          store.insert([
            {id: 1, data: "foo"},
            {id: 2, data: "bar"}
          ])

      it "finds an existing item", ->
        @subject.openStore "TestObjects", (store) ->
          store.find(1).then (item) ->
            expect(item.data).toEqual("foo")

      it "does not find a non-existent item", ->
        @subject.openStore "TestObjects", (store) ->
          store.find(404).then (item) ->
            expect(false).toBeTruthy()
          .catch (error) ->
            expect(true).toBeTruthy()

    describe "#each", ->
      promiseBefore ->
        @subject.openStore "TestObjects", (store) ->
          store.insert([
            {id: 1, data: "foo", name: "bbb"},
            {id: 2, data: "bar", name: "aaa"}
          ])
        @subject.openStore "ComplexTestObjects", (store) ->
          store.insert([
              {id: 1, data: "foo", name: "bbb"},
              {id: 2, data: "bar", name: "aaa"}
            ]
          )

      itPromises " yields the items in succession", ->
        @subject.openStore "TestObjects", (store) ->
          i = 1
          store.each().then null,null, (item) ->
            expect(item.id).toEqual(i)
            i += 1

      itPromises " yields the items in opposite succession given a different direction", ->
        @subject.openStore "TestObjects", (store) =>
          i = 2
          store.each(direction: @subject.queryDirection.descending).then null,null, (item) ->
            expect(item.id).toEqual(i)
            i -= 1

      itPromises " uses a range on the object keys", ->
        @subject.openStore "TestObjects", (store) =>
          i = 1
          store.each(beginKey: 1, endKey: 1).then null,null, (item) ->
            expect(item.id).toEqual(i)
            i += 1
          .then (items) ->
            expect(items.length).toEqual(1)

      itPromises " can operate on an index", ->
        @subject.openStore "ComplexTestObjects", (store) ->
          i = 2
          store.eachBy("name").then null,null, (item) ->
            expect(item.id).toEqual(i)
            i -= 1

    describe "#upsert", ->
      itPromises "adds the item", ->
        @subject.openStore "TestObjects", (store) ->
          store.upsert({id: 1, data: "something"}).then (result) ->
            expect(result).toBeTruthy()
          store.getAll().then (objects) ->
            expect(objects.length).toEqual(1)
            expect(objects[0].data).toEqual("something")
          store.find(1).then (object) ->
            expect(object.id).toEqual(1)

      itPromises "can add an item of the same key twice", ->
        @subject.openStore "TestObjects", (store) ->
          store.upsert({id: 1, data: "something"})
          store.upsert({id: 1, data: "somethingelse"}).catch (errorMessage) ->
            expect(true).toBeFalsy()
          .then ->
            expect(true).toBeTruthy()

      itPromises "can add multiple items", ->
        @subject.openStore "TestObjects", (store) ->
          store.upsert([
            {id: 1, data: "1"},
            {id: 2, data: "2"}
          ]).then (result) ->
            expect(result).toBeTruthy()
          store.getAll().then (objects) ->
            expect(objects.length).toEqual(2)
          store.count().then (count) ->
            expect(count).toEqual(2)

    describe "#insert", ->
      itPromises "adds the item", ->
        @subject.openStore "TestObjects", (store) ->
          store.insert({id: 1, data: "something"}).then (result) ->
            expect(result).toBeTruthy()
          store.getAll().then (objects) ->
            expect(objects.length).toEqual(1)
            expect(objects[0].data).toEqual("something")
          store.find(1).then (object) ->
            expect(object.id).toEqual(1)

      itPromises "cannot add an item of the same key twice", ->
        @subject.openStore "TestObjects", (store) ->
          store.insert({id: 1, data: "something"})
          store.insert({id: 1, data: "somethingelse"}).catch (errorMessage) ->
            expect(errorMessage).toEqual("Key already exists in the object store.")
            return $q.reject("expected")
          .then ->
            expect(false).toBeTruthy()

      itPromises "can add multiple items", ->
        @subject.openStore "TestObjects", (store) ->
          store.insert([
            {id: 1, data: "1"},
            {id: 2, data: "2"}
          ]).then (result) ->
            expect(result).toBeTruthy()
          store.getAll().then (objects) ->
            expect(objects.length).toEqual(2)
          store.count().then (count) ->
            expect(count).toEqual(2)

      itPromises "does nothing for no items", ->
        @subject.openStore "TestObjects", (store) ->
          store.insert([]).then ->
            expect(true).toBeTruthy()




