'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var graphql = require('graphql');
var visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
var dependencyGraph = require('dependency-graph');

/* eslint-disable lines-between-class-members */
const PYTHON_SCALARS = {
  ID: 'str',
  String: 'str',
  Boolean: 'bool',
  Int: 'int',
  Float: 'float'
};
const PYTHON_RESERVED = ['from'];
const PYDANTIC_MODEL_RESERVED = ['copy'];
const RESERVED = /*#__PURE__*/PYTHON_RESERVED.concat(PYDANTIC_MODEL_RESERVED);
class PydanticVisitor extends visitorPluginCommon.BaseVisitor {
  constructor(rawConfig, schema) {
    super(rawConfig, {
      // enumValues: rawConfig.enumValues || {},
      // listType: rawConfig.listType || 'List',
      // package: rawConfig.package || defaultPackageName,
      scalars: visitorPluginCommon.buildScalars(schema, {}, PYTHON_SCALARS)
    });
    this.schema = schema;
    this.addOptionalImport = false;
    this.addAnyImport = false;
    this.addListImport = false;
    this.addUnionImport = false;
    this.addEnumImport = false;
    this.addFieldImport = false;
    this.graph = new dependencyGraph.DepGraph({
      circular: false
    });
  }
  getImports() {
    const typing = [];
    const pydantic = ['BaseModel'];
    if (this.addAnyImport) {
      typing.push(`Any`);
    }
    if (this.addOptionalImport) {
      typing.push(`Optional`);
    }
    if (this.addListImport) {
      typing.push(`List`);
    }
    if (this.addUnionImport) {
      typing.push(`Union`);
    }
    if (this.addFieldImport) {
      pydantic.push(`Field`);
    }
    const enumInput = this.addEnumImport ? 'from enum import StrEnum' : '';
    const typingImport = typing.length ? `from typing import ${typing.join(', ')}` : '';
    const pydanticImport = pydantic.length ? `from pydantic import ${pydantic.join(', ')}` : '';
    return [enumInput, typingImport, pydanticImport].filter(i => i).join('\n');
  }
  canAddGraphNode(id) {
    if (Object.values(this.scalars).includes(id) || id === 'Any') {
      return false;
    }
    return true;
  }
  upsertGraphNode(id) {
    if (this.canAddGraphNode(id) && !this.graph.hasNode(id)) {
      this.graph.addNode(id);
    }
  }
  addGraphNodeDeps(id, ids) {
    if (!this.canAddGraphNode(id)) {
      return;
    }
    this.upsertGraphNode(id);
    ids.forEach(i => {
      if (!this.canAddGraphNode(i)) {
        return;
      }
      this.upsertGraphNode(i);
      this.graph.addDependency(id, i);
    });
  }
  clearOptional(str) {
    if (str.startsWith('Optional[')) {
      return str.replace(/Optional\[(.*?)\]$/, '$1');
    }
    return str;
  }
  Name(node) {
    return node.value;
  }
  NamedType(node) {
    const {
      name
    } = node;
    // Scalars
    if (Object.keys(this.scalars).includes(name)) {
      const id = this.scalars[name];
      // Special case for any
      if (id === 'any') {
        this.addAnyImport = true;
        return {
          id: 'Any',
          source: 'Any'
        };
      }
      this.addOptionalImport = true;
      return {
        id,
        source: `Optional[${id}]`
      };
    }
    // Defined
    this.addOptionalImport = true;
    return {
      id: name,
      source: `Optional['${name}']`
    };
  }
  ListType(node) {
    this.addListImport = true;
    this.addOptionalImport = true;
    const {
      type
    } = node;
    return {
      id: type.id,
      source: `Optional[List[${type.source}]]`
    };
  }
  NonNullType(node) {
    const {
      type
    } = node;
    return {
      id: type.id,
      source: this.clearOptional(type.source)
    };
  }
  visitFieldOrInputDefinition(node) {
    const argName = node.name;
    const {
      type,
      directives
    } = node;
    // Handle deprecated
    // const ds = directives.map((d: any) => d.name);
    // if (ds.includes('deprecated')) {
    //  return null;
    // }
    // Need to alias some field names
    // Otherwise pydantic throws
    if (RESERVED.includes(argName)) {
      this.addFieldImport = true;
      return {
        id: type.id,
        source: visitorPluginCommon.indent(`${argName}_: ${type.source} = Field(None, alias='${argName}')`, 2)
      };
    }
    return {
      id: type.id,
      source: visitorPluginCommon.indent(`${argName}: ${type.source}`, 2)
    };
  }
  FieldDefinition(node) {
    return this.visitFieldOrInputDefinition(node);
  }
  InputValueDefinition(node) {
    return this.visitFieldOrInputDefinition(node);
  }
  EnumTypeDefinition(node) {
    this.addEnumImport = true;
    const {
      name,
      values
    } = node;
    const val = values.map(v => visitorPluginCommon.indent(`${v.name} = '${v.name}'`, 2)).join('\n');
    const source = `class ${name}(StrEnum):\n${val}`;
    this.upsertGraphNode(name);
    return {
      id: name,
      source
    };
  }
  UnionTypeDefinition(node) {
    this.addUnionImport = true;
    const {
      name,
      types
    } = node;
    const unionTypes = (types != null ? types : []).map(t => this.clearOptional(t.source));
    this.addGraphNodeDeps(name, types.map(t => t.id));
    return {
      id: name,
      source: `${name} = Union[${unionTypes.join(', ')}]`
    };
  }
  InterfaceTypeDefinition(node) {
    const {
      name,
      fields: rawFields
    } = node;
    const fields = rawFields.filter(f => f);
    const args = fields.map(f => f.source).join('\n');
    const source = `class ${name}(BaseModel):\n${args}`;
    this.addGraphNodeDeps(name, fields.map(f => f.id));
    return {
      id: name,
      source
    };
  }
  ObjectTypeDefinition(node) {
    const {
      name,
      fields: rawFields,
      interfaces: rawInterfaces
    } = node;
    const fields = rawFields.filter(f => f);
    const interfaces = rawInterfaces.map(n => this.clearOptional(n.source).replace(/'/g, ''));
    const impl = interfaces.length ? interfaces.join(', ') : 'BaseModel';
    const args = fields.map(f => f.source).join('\n');
    const source = `class ${name}(${impl}):\n${args}`;
    if (interfaces.length) {
      this.addGraphNodeDeps(name, interfaces);
    } else {
      this.upsertGraphNode(name);
    }
    return {
      id: name,
      source
    };
  }
  InputObjectTypeDefinition(node) {
    const {
      name,
      fields: rawFields
    } = node;
    const fields = rawFields.filter(f => f);
    const args = fields.map(f => f.source).join('\n');
    const source = `class ${name}(BaseModel):\n${args}`;
    this.upsertGraphNode(name);
    return {
      id: name,
      source
    };
  }
  Document(node) {
    const {
      definitions
    } = node;
    const nodesInOrder = this.graph.overallOrder();
    return nodesInOrder.map(n => {
      var _definitions$find;
      return ((_definitions$find = definitions.find(d => d.id === n)) == null ? void 0 : _definitions$find.source) || '';
    }).join('\n\n\n');
  }
}

// eslint-disable-next-line import/prefer-default-export
const plugin = async (schema, documents, config, info) => {
  const visitor = new PydanticVisitor(config, schema);
  const printedSchema = graphql.printSchema(schema);
  const astNode = graphql.parse(printedSchema);
  const visitorResult = graphql.visit(astNode, {
    leave: visitor
  });
  const imports = visitor.getImports();
  return `${imports}\n\n\n${visitorResult}\n`;
};

exports.plugin = plugin;
//# sourceMappingURL=graphql-codegen-pydantic.cjs.development.js.map
