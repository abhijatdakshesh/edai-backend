interface OrgNode {
    role: string;
    reportsTo?: string;
}
export declare class DirectoryController {
    orgChart(): {
        institution: string;
        hierarchy: OrgNode[];
    };
}
export {};
