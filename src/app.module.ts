import { appConfig, dbConfig } from '@/config';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, appConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('db.host'),
        port: configService.get('db.port'),
        username: configService.get('db.username'),
        password: configService.get('db.password'),
        database: configService.get('db.databaseName'),
        entities: [],
        synchronize: configService.get('db.synchronize'),
        logging: configService.get('db.logging'),
        // this loads all entities defined with TypeOrmModule.forFeature(). So if you get an error about an entity not being found, you probably forgot to add it to the forFeature() array or you need to manually add it here or change your query.
        autoLoadEntities: true,
      })
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
