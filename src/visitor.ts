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
  InterfaceTypeDefinitionNode,
  EnumTypeDefinitionNode,
} from 'graphql';
import { snakeCase } from 'change-case';
import { DepGraph } from 'dependency-graph';

import { PydanticPluginRawConfig } from './config';

export const PYTHON_SCALARS = {
  ID: 'str',
  String: 'str',
  Boolean: 'bool',
  Int: 'int',
  Float: 'float',
  DateTime: 'Any',
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
  private addEnumImport = false;

  private graph = new DepGraph({
    circular: true,
  });

  constructor(
    rawConfig: PydanticPluginRawConfig,
    private schema: GraphQLSchema,
  ) {
    super(rawConfig, {
      // enumValues: rawConfig.enumValues || {},
      // listType: rawConfig.listType || 'List',
      // package: rawConfig.package || defaultPackageName,
      scalars: buildScalars(schema, {}, PYTHON_SCALARS),
    });
  }

  public getImports(): string {
    const typing = ['Any'];
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

    const enumInput = this.addEnumImport ? 'from enum import Enum' : '';

    const typingImport = typing.length
      ? `from typing import ${typing.join(', ')}`
      : '';

    const pydanticImport = pydantic.length
      ? `from pydantic import ${pydantic.join(', ')}`
      : '';

    return [enumInput, typingImport, pydanticImport].filter(i => i).join('\n');
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

  NamedType(node: NamedTypeNode) {
    this.addOptionalImport = true;

    let { name } = node as any;

    if (name === 'any') {
      name = 'Any';
    }

    // If not a scalar, create a node
    if (!this.graph.hasNode(name)) {
      this.graph.addNode(name);
    }

    const source = Object.values(this.scalars).includes(name)
      ? `Optional[${name}]`
      : `Optional['${name}']`;

    return {
      id: name,
      source,
    };
  }

  ListType(node: ListTypeNode) {
    this.addListImport = true;

    const { type } = node as any;

    return {
      id: type.id,
      source: `Optional[List[${type.source}]]`,
    };
  }

  NonNullType(node: NonNullTypeNode) {
    const { type } = node as any;

    return {
      id: type.id,
      source: this.clearOptional(type.source),
    };
  }

  FieldDefinition(node: FieldDefinitionNode) {
    const argName = snakeCase(node.name as any);

    const { type } = node as any;

    return {
      id: type.id,
      source: indent(`${argName}: ${type.source}`, 2),
    };
  }

  EnumTypeDefinition(node: EnumTypeDefinitionNode) {
    this.addEnumImport = true;

    const { name, values } = node as any;

    const val = values
      .map((v: any) => indent(`${v.name} = '${v.name}'`, 2))
      .join('\n');
    const source = `class ${name}(str, Enum):\n${val}`;

    if (!this.graph.hasNode(name)) {
      this.graph.addNode(name);
    }

    return {
      id: name,
      source,
    };
  }

  UnionTypeDefinition(node: UnionTypeDefinitionNode) {
    this.addUnionImport = true;

    const { name, types } = node as any;

    const unionTypes = (types ?? []).map((t: any) =>
      this.clearOptional(t.source),
    );

    if (!this.graph.hasNode(name)) {
      this.graph.addNode(name);
    }

    types.forEach((t: any) => {
      if (!this.graph.hasNode(t.id)) {
        this.graph.addNode(t.id);
      }

      this.graph.addDependency(name, t.id);
    });

    return {
      id: name,
      source: `${name} = Union[${unionTypes.join(', ')}]`,
    };
  }

  InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode) {
    const modelName = node.name as any;
    const modelDef = `class ${modelName}(BaseModel):`;
    const modelArguments = (node.fields ?? [])
      .map((f: any) => f.source)
      .join('\n');

    if (!this.graph.hasNode(modelName)) {
      this.graph.addNode(modelName);
    }

    (node.fields ?? []).forEach((t: any) => {
      if (!this.graph.hasNode(t.id)) {
        this.graph.addNode(t.id);
      }

      this.graph.addDependency(modelName, t.id);
    });

    return {
      id: modelName,
      source: [modelDef, modelArguments].join('\n'),
    };
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
    const modelName = node.name as any;
    const interfaces = (node.interfaces as any).map((n: any) =>
      this.clearOptional(n.source).replace(/'/g, ''),
    );
    const is = interfaces.length ? interfaces.join(', ') : 'BaseModel';
    const modelDef = `class ${modelName}(${is}):`;
    const modelArguments = (node.fields ?? [])
      .map((f: any) => f.source)
      .join('\n');

    if (!this.graph.hasNode(modelName)) {
      this.graph.addNode(modelName);
    }

    const deps: any[] = [];

    interfaces.forEach((t: any) => {
      if (!this.graph.hasNode(t)) {
        this.graph.addNode(t);
      }

      deps.push(t);
      this.graph.addDependency(modelName, t);
    });

    // (node.fields ?? []).forEach((t: any) => {
    //   if (!this.graph.hasNode(t.id)) {
    //     this.graph.addNode(t.id);
    //   }

    //   deps.push(t.id);
    //   this.graph.addDependency(modelName, t.id);
    // });

    return {
      id: modelName,
      source: [modelDef, modelArguments].join('\n'),
      deps,
    };
  }

  Document(node: DocumentNode) {
    const { definitions } = node as any;

    const nodesInOrder = this.graph
      .overallOrder()
      .filter((n: any) => definitions.find((d: any) => d.id === n));

    return nodesInOrder
      .map((n: any, i) => {
        const before = this.graph.dependenciesOf(n);
        const after = this.graph.dependantsOf(n);

        // console.log(n);
        // console.log(before.filter(b => after.includes(b)));

        const b = this.graph.dependenciesOf(n);
        const a = nodesInOrder.slice(i);
        const both = b.filter(bb => a.includes(bb));
        // console.log(both);

        const def = definitions.find((d: any) => d.id === n);

        const toFix = (def.deps ?? []).filter((d: any) => both.includes(d));

        // toFix.forEach((fix: any) => {

        // });

        return n;
      })
      .map((n: any) => definitions.find((d: any) => d.id === n)?.source || '')
      .join('\n\n\n');
  }
}
