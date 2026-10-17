/**
 * @author Avesd
 * @package Workspace Model
 * @namespace Root
 * @description Workspace Model exports
 */

export type { CanvasMetadata } from "./canvas/canvas-metadata";
export { readCanvasMetadata, writeCanvasMetadata } from "./canvas/canvas-metadata";
export type { BlockAction, BlockChange, BlockData, BlockQuestion, BlockQuestionOwner, BlockSource, DashboardBlock } from "./canvas/dashboard-blocks";
export { blockActionSchema, blockBindingSchema, blockBoundsSchema, blockChangeSchema, blockDataSchema, blockIdSchema, blockQuestionInputSchema, blockQuestionSchema, blockRevisionSchema, blockSourceSchema, changeDashboardBlocks, dashboardBlockSchema, questionAnswers, readDashboardBlocks, writeDashboardBlocks } from "./canvas/dashboard-blocks";
export { InMemoryWorkspaceRepository } from "./repository/in-memory-workspace-repository";
export type { WorkspacePersistenceDriver } from "./repository/persistent-workspace-repository";
export { PersistentWorkspaceRepository } from "./repository/persistent-workspace-repository";
export { parseWorkspaceSnapshot } from "./repository/workspace-snapshot";
export type { PluginDatabase, PluginFileEntry, PluginFileService, PluginSqliteService, SqlMutationResult, SqlStatement, SqlValue } from "./resources/plugin-storage";
export type { PluginResourceService, ResourceAccess, ResourceContract, ResourceIdentity, ResourceKind, ResourcePublication, ResourceQuery, ResourceRecord, SharedFile, SharedResource } from "./resources/shared-resources";
export { describeResource, resourceAccess } from "./resources/shared-resources";
export type {
    ApplyDashboardLayout,
    DashboardLayoutErrorCode,
    DashboardLayoutOperation,
    DashboardLayoutService,
    WidgetDefinition,
    WidgetDefinitionResolver,
    WidgetInputDefinition,
    WidgetSize,
} from "./widgets/dashboard-layout";
export {
    DASHBOARD_GRID_COLUMNS,
    DashboardLayoutCoordinator,
    DashboardLayoutError,
    findAvailablePlacement,
} from "./widgets/dashboard-layout";
export type {
    CreateDataSourceCommand,
    DataSourceDefinition,
    DataSourceDefinitionResolver,
    DataSourceService,
} from "./widgets/data-sources";
export { WorkspaceDataCoordinator } from "./widgets/data-sources";
export type { DashboardSummary, WidgetCatalogService, WidgetManagementService, WidgetNavigationService, WidgetWorkspaceCapability, WidgetWorkspaceServices, WorkspaceCatalogQuery, WorkspaceCatalogResult, WorkspaceManagementCommand } from "./workspace/workspace-catalog";
export { readWorkspaceCatalog } from "./workspace/workspace-catalog";
export type {
    CreateDashboard,
    CreateDataSource,
    CreateWidgetInstance,
    CreateWorkspace,
    Dashboard,
    DashboardDataSourceScope,
    DashboardId,
    DashboardLayoutSnapshot,
    DashboardScope,
    DataSource,
    DataSourceId,
    DataSourceScope,
    GridPlacement,
    JsonObject,
    JsonValue,
    WidgetInstance,
    WidgetInstanceId,
    Workspace,
    WorkspaceDataSourceScope,
    WorkspaceId,
    WorkspaceRepository,
    WorkspaceRepositoryListener,
    WorkspaceScope,
    WorkspaceSnapshot,
} from "./workspace/workspace-model";
export { WorkspaceModelError } from "./workspace/workspace-model-error";
export type { WorkspaceNavigationCommand, WorkspaceNavigationState } from "./workspace/workspace-navigation";
export { navigateWorkspace, sameDashboard } from "./workspace/workspace-navigation";
