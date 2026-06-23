import type { Document } from 'mongoose';
import type { IUser } from './user.schema';

/**
 * 관리자 화면용 사용자 뷰모델.
 * API가 내려주는 직렬화된 평문 형태(_id: string)이며, Mongoose Document가 아니다.
 */
export type AdminUserView = Omit<IUser, keyof Document> & {
  _id: string;
  likesCount?: number;
  playlistsCount?: number;
};

/** 사용자 권한 역할 리터럴 유니온 */
export type UserRoleValue = IUser['role'];
