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

