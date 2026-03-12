import { ModelConstructorType } from 'src/db/entity-model';
import {
  EntityManager,
  EntityTarget,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';

export abstract class BaseDBUtil<
  ModelType extends InstanceType<ModelConstructorType>,
  CreationDataType extends object,
> {
  constructor(
    private readonly model: EntityTarget<ModelType>,
    protected readonly repo: Repository<ModelType>,
  ) {}

  public async getOne(params: {
    criteria: FindOptionsWhere<ModelType>;
    entityManager?: EntityManager;
    relation?: FindOptionsRelations<ModelType>;
    withDeleted?: boolean;
  }): Promise<ModelType | null> {
    const { criteria, entityManager, relation, withDeleted } = params;
    const repo =
      (entityManager?.getRepository(this.model) as Repository<ModelType>) ??
      this.repo;

    return await repo.findOne({
      where: criteria,
      transaction: true,
      relations: relation,
      withDeleted,
    });
  }

  public async getAll(options?: {
    entityManager?: EntityManager;
    relation?: FindOptionsRelations<ModelType>;
    criteria?: FindOptionsWhere<ModelType>;
  }): Promise<ModelType[]> {
    const repo =
      (options?.entityManager?.getRepository(
        this.model,
      ) as Repository<ModelType>) ?? this.repo;

    return await repo.find({
      where: options?.criteria,
      relations: options?.relation,
      transaction: true,
    });
  }

  public async has(params: {
    criteria: FindOptionsWhere<ModelType>;
    entityManager?: EntityManager;
    relation?: FindOptionsRelations<ModelType>;
  }): Promise<boolean> {
    const { criteria, entityManager, relation } = params;
    const repo =
      (entityManager?.getRepository(this.model) as Repository<ModelType>) ??
      this.repo;

    const count = await repo.count({
      where: criteria,
      relations: relation,
    });

    return count > 0;
  }

  public abstract create(params: {
    creationData: CreationDataType;
    entityManager?: EntityManager;
  }): Promise<ModelType>;

  public async updateWithSave(params: {
    dataArray: ModelType[];
    entityManager?: EntityManager;
  }): Promise<ModelType[]> {
    const { dataArray, entityManager } = params;
    const repo =
      (entityManager?.getRepository(this.model) as Repository<ModelType>) ??
      this.repo;

    return await repo.save(dataArray);
  }

  public async delete(params: {
    criteria: FindOptionsWhere<ModelType>;
    entityManager?: EntityManager;
    relation?: FindOptionsRelations<ModelType>;
  }): Promise<ModelType[] | null> {
    const { criteria, entityManager, relation } = params;
    const repo =
      (entityManager?.getRepository(this.model) as Repository<ModelType>) ??
      this.repo;

    const existingData = await repo.find({
      where: criteria,
      relations: relation,
    });

    if (!existingData.length) return null;

    return await repo.softRemove(existingData);
  }
}
