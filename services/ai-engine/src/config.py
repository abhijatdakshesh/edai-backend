from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8001
    redis_url: str = "redis://localhost:6379"
    sarvam_api_key: str = ""
    ai4bharat_api_key: str = ""
    bhashini_api_key: str = ""
    anthropic_api_key: str = ""
    litellm_base_url: str = "http://litellm:4000"
    openai_api_key: str = ""
    aws_s3_bucket: str = "edai-recordings"
    aws_region: str = "ap-south-1"

    class Config:
        env_file = ".env"


settings = Settings()
