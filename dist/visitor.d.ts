import { BaseVisitor, ParsedConfig } from '@graphql-codegen/visitor-plugin-common';
import { NamedTypeNode, ListTypeNode, NonNullTypeNode, GraphQLSchema, FieldDefinitionNode, ObjectTypeDefinitionNode, NameNode, UnionTypeDefinitionNode, DocumentNode, InterfaceTypeDefinitionNode, EnumTypeDefinitionNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode } from 'graphql';
import { PydanticPluginRawConfig } from './config';
export declare const PYTHON_SCALARS: {
    ID: string;
    String: string;
    Boolean: string;
    Int: string;
    Float: string;
};
export interface PydanticPluginParsedConfig extends ParsedConfig {
}
export declare class PydanticVisitor extends BaseVisitor<PydanticPluginRawConfig, PydanticPluginParsedConfig> {
    private schema;
    private addOptionalImport;
    private addAnyImport;
    private addListImport;
    private addUnionImport;
    private addEnumImport;
    private addFieldImport;
    private graph;
    constructor(rawConfig: PydanticPluginRawConfig, schema: GraphQLSchema);
    getImports(): string;
    protected canAddGraphNode(id: string): boolean;
    protected upsertGraphNode(id: string): void;
    protected addGraphNodeDeps(id: string, ids: string[]): void;
    protected clearOptional(str: string): string;
    Name(node: NameNode): string;
    NamedType(node: NamedTypeNode): {
        id: any;
        source: string;
    };
    ListType(node: ListTypeNode): {
        id: any;
        source: string;
    };
    NonNullType(node: NonNullTypeNode): {
        id: any;
        source: string;
    };
    protected visitFieldOrInputDefinition(node: any): {
        id: any;
        source: string;
    };
    FieldDefinition(node: FieldDefinitionNode): {
        id: any;
        source: string;
    };
    InputValueDefinition(node: InputValueDefinitionNode): {
        id: any;
        source: string;
    };
    EnumTypeDefinition(node: EnumTypeDefinitionNode): {
        id: any;
        source: string;
    };
    UnionTypeDefinition(node: UnionTypeDefinitionNode): {
        id: any;
        source: string;
    };
    InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode): {
        id: any;
        source: string;
    };
    ObjectTypeDefinition(node: ObjectTypeDefinitionNode): {
        id: any;
        source: string;
    };
    InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode): {
        id: any;
        source: string;
    };
    Document(node: DocumentNode): string;
}
