angular-indexedDB
=================

An angularjs serviceprovider to utilize indexedDB with angular

## Installation

For installation the use of Bower is recommended.

### Bower
Call the following command on your command line: 

```sh
bower install git@github.com:webcss/angular-indexedDB.git --save
```

And add the following line to your html file, for example `index.html`:

```html
<script src="components/angular-indexedDB/src/indexeddb.js"></script>
```


### Manual

- Download file.
- Add the following line to your html file:

```html
<script src="indexeddb.js"></script>
```

## Usage

Normally, and as a recommendation, you have only one indexedDB per app.
Thus in your `app.js` where you define your module, you do:

```javascript
angular.module('myModuleName', ['xc.indexedDB'])
  .config(function ($indexedDBProvider) {
    $indexedDBProvider
      .connection('myIndexedDB')
      .upgradeDatabase(myVersion, function(event, db, tx){
        var objStore = db.createObjectStore('people', {keypath: 'ssn'});
        objStore.createIndex('name_idx', 'name', {unique: false});
        objStore.createIndex('age_idx', 'age', {unique: false});
      });
  });
```
The connection method takes the databasename as parameter,
the upgradeCallback has 3 parameters:
function callback(event, database, transaction). For upgrading your db structure, see 
https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB.

You can also define your own error handlers, overwriting the default ones, which log to console.


Inside your controller you use `$indexedDB` like this:

```javascript
angular.module('myModuleName')
  .controller('myControllerName', function($scope, $indexedDB) {
    
    $scope.objects = [];
    
    var OBJECT_STORE_NAME = 'people';  
        
    /**
     * @type {ObjectStore}
     */
    var myObjectStore = $indexedDB.objectStore(OBJECT_STORE_NAME);
    
    myObjectStore.insert({"ssn": "444-444-222-111","name": "John Doe", "age": 57}).then(function(e){...});
    
    myObjectStore.getAll().then(function(results) {  
      // Update scope
      $scope.objects = results;
    });

  /**
   * execute a query:
   * presuming we've an index on 'age' field called 'age_idx'
   * find all persons older than 40 years
   */
   
   var myQuery = $indexedDB.queryBuilder.$index('age_idx').$gt(40).$asc.compile;
   myObjectStore.each(myQuery).then(function(cursor){
     cursor.key;
     cursor.value;
     ...
   });
  });
```

QueryBuilder aka IDBKeyRange maybe needs some revision.
This is all the info you get for now, for more read the code, it's ndoc-annotated! 

Important note: that this software is in alpha state and therefore it's used at your own risk,
don't make me liable for any damages or loss of data!

