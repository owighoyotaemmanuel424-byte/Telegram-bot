export interface TelegramPhotoSize { file_id: string; width: number; height: number; file_size?: number; }
export interface TelegramFile { file_id: string; file_unique_id: string; file_size?: number; file_path?: string; }
export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; is_bot: boolean; first_name?: string; last_name?: string; username?: string; language_code?: string };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  video?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
  audio?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
  voice?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
  document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: { id: string; data?: string; message?: TelegramMessage };
}
