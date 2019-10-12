const { printSchema, parse, visit } = require('graphql');

module.exports = {
  plugin: (schema, documents, config) => {
    const printedSchema = printSchema(schema);
    const astNode = parse(printedSchema);
    const visitor = {
      Name: node => {
        return node.value;
      },
      NamedType: node => {
        let val = node.name;

        switch(val) {
          case 'Boolean':
            val = 'bool';
            break;
          case 'ID':
            val = 'str';
            break;
          case 'String':
            val = 'str';
            break;
          case 'Int':
            val = 'int';
            break;
          case 'Float':
            val = 'float';
            break;
          default:
            val = `'${val}'`;
        }

        return `Optional[${val}]`;
      },
      ListType: node => {
        return `Optional[List[${node.type}]]`;
      },
      NonNullType: node => {
        return node.type.startsWith('Optional[')
          ? node.type.substring(9, node.type.length - 1)
          : node.type;
      },
      FieldDefinition: node => {
        return `${node.name}: ${node.type}`;
      },
      ObjectTypeDefinition: node => {
        return `
class ${node.name}(BaseModel):
    ${node.fields.join('\n    ')}
`;
      },
      InputValueDefinition: node => {
        return `${node.name}: ${node.type}`;
      },
      InputObjectTypeDefinition: node => {
        return `
class ${node.name}(BaseModel):
    ${node.fields.join('\n    ')}
`;
      },
    };

    const result = visit(astNode, { leave: visitor });

    const header = `
from typing import List, Optional
from pydantic import BaseModel
`;

    return header + '\n' + result.definitions.join('\n');
  },
};