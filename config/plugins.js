module.exports = ({ env }) => ({
  'import-export-entries': {
    enabled: true,
    config: {
      // "collectionName": "customers",
      // "info": {
      //   "displayName": "Customers",
      // },
      // "options": {},
      // /**
      //  * In the property `pluginOptions`, define the `idField` under the property `import-export-entries`.
      //  *
      //  * `idField` must match the name of an attribute.
      //  */
      // "pluginOptions": {
      //   "import-export-entries": {
      //     "idField": "name"
      //   }
      // },
      // "attributes": {
      //   "name": { // 👈 `name` will be used to find a hospital when importing data.
      //     "type": "string",
      //     "unique": true
      //   },
      //   "employees": {
      //     "type": "relation",
      //     "relation": "oneToMany",
      //     "target": "api::employees.employees"
      //   },
      //   "patients": {
      //     "type": "relation",
      //     "relation": "oneToMany",
      //     "target": "api::patients.patients"
      //   },
      // }
    },
  },
});
