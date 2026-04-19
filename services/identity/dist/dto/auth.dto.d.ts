export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RefreshDto {
    refreshToken: string;
}
export declare class LogoutDto {
    refreshToken: string;
}
export declare class LinkStudentDto {
    parentId: string;
    studentId: string;
    otp: string;
}
