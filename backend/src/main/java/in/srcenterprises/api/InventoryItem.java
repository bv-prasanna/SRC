package in.srcenterprises.api;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
@Entity @Table(name="inventory_items",uniqueConstraints=@UniqueConstraint(columnNames={"sku","locationCode"}))
public class InventoryItem {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @NotBlank @Size(max=80) @Column(nullable=false) public String sku;
 @NotBlank @Size(max=60) @Column(nullable=false) public String locationCode;
 @NotNull @Min(0) @Column(nullable=false) public Integer onHand=0;
 @NotNull @Min(0) @Column(nullable=false) public Integer reorderThreshold=0;
 @NotNull public Boolean active=true;
 @Version public Long version;
}
