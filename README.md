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

### Manual

- Download file.
- Add the following line to your html file:

```html
<script src="indexeddb.js"></script>
```

## Usage

In your app.js where you define your module:

```javascript
angular.module('myModuleName', ['xc.indexedDB']).config(function ($indexedDBProvider) {
  // Here you can configure `$indexedDBProvider`.
});
```


Inside your controller you can use `$indexedDB`:

```javascript
angular.module('myModuleName').controller('myControllerName', function($scope, $indexedDB) {
  
  $scope.objects = [];
  
  var OBJECT_STORE_NAME = 'objectStoreName';
  var DATABASE_NAME = 'databaseName';
  var DATABASE_VERSION = 1;
  var KEY_PATH = 'id';
  
  
  $indexedDB.switchDB(DATABASE_NAME, DATABASE_VERSION, function onUpgradeNeeded(e, database, transaction) {
    
    /**
     * @type {ObjectStore}
     */
    var store = database.createObjectStore(OBJECT_STORE_NAME, {
        autoIncrement: true,
        keyPath: KEY_PATH
    });
    
    
  });
  
  /**
   * @type {ObjectStore}
   */
  var myObjectStore = $indexedDB.objectStore(OBJECT_STORE_NAME);
  
  
  myObjectStore.getAll().then(function onSuccess(objects) {
    
    // Update scope
    $scope.objects = objects;
  });
});
```
