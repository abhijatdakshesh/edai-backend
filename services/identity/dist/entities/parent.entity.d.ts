export type Relation = 'FATHER' | 'MOTHER' | 'GUARDIAN';
export interface Parent {
    id: string;
    userId: string;
    relation: Relation;
    phoneToken: string;
    whatsapp?: string;
    email?: string;
    preferredLanguage: string;
    consentFlags: {
        voice: boolean;
        whatsapp: boolean;
        sms: boolean;
        email: boolean;
    };
    createdAt: string;
}
