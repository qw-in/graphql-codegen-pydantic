import { printSchema, parse, visit } from 'graphql';

// eslint-disable-next-line import/prefer-default-export
export const plugin = (schema: any, documents: any, config: any) => {
  const printedSchema = printSchema(schema);
  const astNode = parse(printedSchema);
  const visitor = {
    Name: (node: { value: any }) => {
      return node.value;
    },
    NamedType: (node: { name: any }) => {
      let val = node.name;

      switch (val) {
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
    ListType: (node: { type: any }) => {
      return `Optional[List[${node.type}]]`;
    },
    NonNullType: (node: { type: string }) => {
      return node.type.startsWith('Optional[')
        ? node.type.substring(9, node.type.length - 1)
        : node.type;
    },
    FieldDefinition: (node: { name: any; type: any }) => {
      return `${node.name}: ${node.type}`;
    },
    ObjectTypeDefinition: (node: { name: any; fields: any[] }) => {
      return `
class ${node.name}(BaseModel):
    ${node.fields.join('\n    ')}
`;
    },
    InputValueDefinition: (node: { name: any; type: any }) => {
      return `${node.name}: ${node.type}`;
    },
    InputObjectTypeDefinition: (node: { name: any; fields: any[] }) => {
      return `
class ${node.name}(BaseModel):
    ${node.fields.join('\n    ')}
`;
    },
  };

  const result = visit(astNode, { leave: visitor as any });

  const header = `
from typing import List, Optional
from pydantic import BaseModel
`;

  return `${header}\n${result.definitions.join('\n')}`;
};
