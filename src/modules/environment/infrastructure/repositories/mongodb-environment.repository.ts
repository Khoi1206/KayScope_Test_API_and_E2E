import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/db/mongodb'
import { IEnvironmentRepository } from '../../domain/repositories/environment.repository'
import { Environment, CreateEnvironmentDTO, UpdateEnvironmentDTO, EnvironmentVariable } from '../../domain/entities/environment.entity'

interface EnvironmentDocument {
  _id: ObjectId
  workspaceId: ObjectId
  name: string
  variables: EnvironmentVariable[]
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}

function toEntity(doc: EnvironmentDocument): Environment {
  return {
    id: doc._id.toHexString(),
    workspaceId: doc.workspaceId.toHexString(),
    name: doc.name,
    variables: doc.variables ?? [],
    createdBy: doc.createdBy.toHexString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

let indexEnsured: Promise<void> | undefined
async function ensureIndexes(): Promise<void> {
  if (!indexEnsured) {
    indexEnsured = getDatabase()
      .then(db => db.collection('environments').createIndex({ workspaceId: 1 }))
      .then(() => {})
      .catch(() => {})
  }
  return indexEnsured
}

export class MongoDBEnvironmentRepository implements IEnvironmentRepository {
  private async collection() {
    await ensureIndexes()
    const db = await getDatabase()
    return db.collection<EnvironmentDocument>('environments')
  }

  async findById(id: string): Promise<Environment | null> {
    const col = await this.collection()
    const doc = await col.findOne({ _id: new ObjectId(id) })
    return doc ? toEntity(doc) : null
  }

  async findByWorkspace(workspaceId: string): Promise<Environment[]> {
    const col = await this.collection()
    const docs = await col.find({ workspaceId: new ObjectId(workspaceId) }).sort({ createdAt: -1 }).toArray()
    return docs.map(toEntity)
  }

  async create(dto: CreateEnvironmentDTO): Promise<Environment> {
    const col = await this.collection()
    const now = new Date()
    const doc: Omit<EnvironmentDocument, '_id'> = {
      workspaceId: new ObjectId(dto.workspaceId),
      name: dto.name,
      variables: dto.variables ?? [],
      createdBy: new ObjectId(dto.createdBy),
      createdAt: now,
      updatedAt: now,
    }
    const result = await col.insertOne(doc as EnvironmentDocument)
    return toEntity({ ...doc, _id: result.insertedId } as EnvironmentDocument)
  }

  async update(id: string, dto: UpdateEnvironmentDTO): Promise<Environment | null> {
    const col = await this.collection()
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...dto, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    return result ? toEntity(result) : null
  }

  async delete(id: string): Promise<boolean> {
    const col = await this.collection()
    const result = await col.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0
  }
}
