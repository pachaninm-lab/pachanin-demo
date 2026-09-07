import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  GU12_CARGO_MAX,
  GU12_MAX_WAGONS,
  GU12_STATION_MAX,
  GU12_VOLUME_MAX_TONS,
  GU12_VOLUME_MIN_TONS,
  RAILWAY_ID_MAX,
  WAGON_CAPACITY_MAX_TONS,
  WAGON_CAPACITY_MIN_TONS,
  WAGON_NUMBER_PATTERN,
  WAGON_STATUSES,
  WAGON_TYPES,
} from '../railway.contract';
import type { WagonStatus, WagonType } from '../railway.contract';

/**
 * Тела железнодорожного модуля.
 *
 * Инлайн-тип `@Body() body: { … }` стирается до `Object`, и глобальный
 * ValidationPipe на него не действует — измерено в
 * `common/validation/request-body-validation-mechanism.spec.ts`.
 *
 * Здесь это было не только пропущенной проверкой. Контроллер передавал тело
 * в сервис россыпью — `{ ...body, ownerOrgId: user.orgId }`, — а сервис строил
 * запись как `{ id: randomUUID(), ...dto }`, поэтому присланный клиентом `id`
 * побеждал сгенерированный. `whitelist: true` срезает поле, у которого нет
 * ни одного декоратора, и именно это закрывает границу; сервис исправлен
 * отдельно, чтобы порядок полей больше ничего не решал.
 */

export class RegisterWagonDto {
  @IsString()
  @Matches(WAGON_NUMBER_PATTERN)
  wagonNumber!: string;

  @IsIn(WAGON_TYPES)
  type!: WagonType;

  /**
   * Без `@Type(() => Number)`: приведение выполнялось бы до проверки, и строка
   * молча стала бы числом — класс дефекта, найденный ревью в #4993.
   */
  @IsNumber()
  @Min(WAGON_CAPACITY_MIN_TONS)
  @Max(WAGON_CAPACITY_MAX_TONS)
  capacityTons!: number;
}

export class UpdateWagonStatusDto {
  @IsIn(WAGON_STATUSES)
  status!: WagonStatus;

  @IsOptional()
  @IsString()
  @Length(1, RAILWAY_ID_MAX)
  dealId?: string;
}

export class CreateGU12Dto {
  @IsString()
  @Length(1, RAILWAY_ID_MAX)
  dealId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(GU12_MAX_WAGONS)
  @IsString({ each: true })
  @Length(1, RAILWAY_ID_MAX, { each: true })
  wagonIds!: string[];

  @IsString()
  @Length(1, GU12_STATION_MAX)
  departureStation!: string;

  @IsString()
  @Length(1, GU12_STATION_MAX)
  destinationStation!: string;

  @IsString()
  @Length(1, GU12_CARGO_MAX)
  cargo!: string;

  @IsNumber()
  @Min(GU12_VOLUME_MIN_TONS)
  @Max(GU12_VOLUME_MAX_TONS)
  volumeTons!: number;

  @IsDateString({ strict: true })
  requestedDepartureAt!: string;
}

/**
 * Демередж — это деньги. Неразбираемая дата давала `detainedHours: NaN` и
 * `totalKopecks: NaN`, а в JSON это уезжало как `null`: запись о простое без
 * суммы. Строгий режим отклоняет и несуществующие даты вроде 31 февраля.
 */
export class CalculateDemurrageDto {
  @IsString()
  @Length(1, RAILWAY_ID_MAX)
  wagonId!: string;

  @IsOptional()
  @IsString()
  @Length(1, RAILWAY_ID_MAX)
  dealId?: string;

  @IsDateString({ strict: true })
  arrivedAt!: string;

  @IsDateString({ strict: true })
  unloadingCompletedAt!: string;
}
