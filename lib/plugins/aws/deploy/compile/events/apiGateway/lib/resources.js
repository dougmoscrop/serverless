'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {

  compileResources() {
    const resourcePaths = this.getResourcePaths();

    this.apiGatewayResourceLogicalIds = {};

    // ['users', 'users/create', 'users/create/something']
    resourcePaths.forEach(path => {
      const pathArray = path.split('/');
      const resourceName = pathArray.map(this.capitalizeAlphaNumericPath).join('');
      const resourceLogicalId = `ApiGatewayResource${resourceName}`;
      const pathPart = pathArray.pop();
      const parentPath = pathArray.join('/');
      const parentRef = this.getResourceId(parentPath);

      this.apiGatewayResourceLogicalIds[path] = resourceLogicalId;

      _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
        [resourceLogicalId]: {
          Type: 'AWS::ApiGateway::Resource',
          Properties: {
            ParentId: parentRef,
            PathPart: pathPart,
            RestApiId: { Ref: this.apiGatewayRestApiLogicalId },
          },
        },
      });
    });
    return BbPromise.resolve();
  },

  getResourcePaths() {
    const paths = _.reduce(this.validated.events, (resourcePaths, event) => {
      let path = event.http.path;

      while (path !== '') {
        if (resourcePaths.indexOf(path) === -1) {
          resourcePaths.push(path);
        }

        const splittedPath = path.split('/');
        splittedPath.pop();
        path = splittedPath.join('/');
      }
      return resourcePaths;
    }, []);
    // (stable) sort so that parents get processed before children
    return _.sortBy(paths, path => path.split('/').length);
  },

  capitalizeAlphaNumericPath(path) {
    return _.upperFirst(
      _.capitalize(path)
      .replace(/-/g, 'Dash')
      .replace(/\{(.*)\}/g, '$1Var')
      .replace(/[^0-9A-Za-z]/g, '')
    );
  },

  getResourceId(path) {
    if (path === '') {
      return { 'Fn::GetAtt': [this.apiGatewayRestApiLogicalId, 'RootResourceId'] };
    }
    return { Ref: this.apiGatewayResourceLogicalIds[path] };
  },
};
