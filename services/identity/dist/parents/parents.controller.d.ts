import { ParentsService } from './parents.service';
import { LinkStudentDto } from '../dto/auth.dto';
export declare class ParentsController {
    private readonly parentsService;
    constructor(parentsService: ParentsService);
    linkStudent(dto: LinkStudentDto): {
        linked: boolean;
    };
}
