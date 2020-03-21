/* eslint-disable lines-between-class-members */
/* eslint-disable class-methods-use-this */
/* eslint-disable react/no-this-in-sfc */
import {
  BaseVisitor,
  ParsedConfig,
  buildScalars,
  indent,
} from '@graphql-codegen/visitor-plugin-common';
import {
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,
  GraphQLSchema,
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
  NameNode,
  UnionTypeDefinitionNode,
  DocumentNode,
} from 'graphql';
import { snakeCase, pascalCase } from 'change-case';
import { PydanticPluginRawConfig } from './config';

export const PYTHON_SCALARS = {
  ID: 'str',
  String: 'str',
  Boolean: 'bool',
  Int: 'int',
  Float: 'float',
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PydanticPluginParsedConfig extends ParsedConfig {
  /* intentionally empty for now */
}

export class PydanticVisitor extends BaseVisitor<
  PydanticPluginRawConfig,
  PydanticPluginParsedConfig
> {
  private addOptionalImport = false;
  private addListImport = false;
  private addUnionImport = false;

  constructor(
    rawConfig: PydanticPluginRawConfig,
    private _schema: GraphQLSchema,
  ) {
    super(rawConfig, {
      // enumValues: rawConfig.enumValues || {},
      // listType: rawConfig.listType || 'List',
      // package: rawConfig.package || defaultPackageName,
      scalars: buildScalars(_schema, {}, PYTHON_SCALARS),
    });
  }

  public getImports(): string {
    const typing = [];
    const pydantic = ['BaseModel'];

    if (this.addOptionalImport) {
      typing.push(`Optional`);
    }

    if (this.addListImport) {
      typing.push(`List`);
    }

    if (this.addUnionImport) {
      typing.push(`Union`);
    }

    const typingImport = typing.length
      ? `from typing import ${typing.join(', ')}`
      : '';

    const pydanticImport = pydantic.length
      ? `from pydantic import ${pydantic.join(', ')}`
      : '';

    return [typingImport, pydanticImport].filter(i => i).join('\n');
  }

  protected clearOptional(str: string): string {
    if (str.startsWith('Optional[')) {
      return str.replace(/Optional\[(.*?)\]$/, '$1');
    }

    return str;
  }

  Name(node: NameNode) {
    const { value } = node;

    let convertedName = value;
    if (Object.keys(this.scalars).includes(value)) {
      convertedName = this.scalars[value];
    }

    return convertedName;
  }

  NamedType(node: NamedTypeNode): string {
    this.addOptionalImport = true;

    const { name } = node as any;

    return `Optional[${name}]`;
  }

  ListType(node: ListTypeNode): string {
    this.addListImport = true;

    const { type } = node;
    return `Optional[List[${type}]]`;
  }

  UnionTypeDefinition(node: UnionTypeDefinitionNode): string {
    this.addUnionImport = true;

    const { name, types } = node;

    const unionTypes = (types ?? []).map(t => this.clearOptional(t as any));

    return `${name} = Union[${unionTypes.join(', ')}]`;
  }

  NonNullType(node: NonNullTypeNode): string {
    const { type } = node;

    return this.clearOptional((type as unknown) as string);
  }

  FieldDefinition(node: FieldDefinitionNode): string {
    const argName = snakeCase(node.name as any);
    return indent(`${argName}: ${node.type}`, 2);
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string {
    const modelName = pascalCase(node.name as any);
    const modelDef = `class ${modelName}(BaseModel):`;
    const modelArguments = (node.fields ?? []).join('\n');

    return [modelDef, modelArguments].join('\n');
  }

  Document(node: DocumentNode) {
    return node.definitions
      .filter((d: any) => typeof d === 'string')
      .join('\n\n\n');
  }
}
