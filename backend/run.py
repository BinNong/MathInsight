from app import create_app
from app.config import Config

app = create_app()

if __name__ == '__main__':
    # 生产环境应设置为 false，development 模式应仅在开发时开启
    app.run(debug=Config.FLASK_DEBUG, host='0.0.0.0', port=5000)
